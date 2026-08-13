const Issue = require('../models/Issue');
const Project = require('../models/Project');
const { emitToProject } = require('../socket/socketHandler');
const { createAlert } = require('./alertService');
const { analyzeIssueWithAI } = require('./aiService');
const { classifyWebRequest } = require('./mlService');
const { detectAttackPatterns } = require('./patternDetectionService');
const { recordAndCheck } = require('./sequenceDetectionService');

let watcherInterval = null;

const analyzeIssues = async (project, newLogs, newMetrics) => {
  const projectId = project.projectId;
  const thresholds = project.alertThresholds;

  // --- Log Watcher ---
  const errorLogs = newLogs.filter(l => l.level === 'error' || l.level === 'fatal');
  if (errorLogs.length >= 3) {
    await detectOrUpdateIssue(project, {
      type: 'error_spike',
      severity: errorLogs.some(l => l.level === 'fatal') ? 'critical' : 'high',
      title: `Error spike: ${errorLogs.length} errors in batch`,
      description: errorLogs.map(l => l.message).join(' | '),
      endpoint: errorLogs[0]?.endpoint,
      traceFile: errorLogs[0]?.traceFile,
      traceLine: errorLogs[0]?.traceLine
    });
  }

  // --- API Watcher ---
  for (const metric of newMetrics) {
    // Slow response
    if (metric.responseTime && metric.responseTime > thresholds.responseTime) {
      await detectOrUpdateIssue(project, {
        type: 'slow_response',
        severity: metric.responseTime > thresholds.responseTime * 2 ? 'critical' : 'high',
        title: `Slow response on ${metric.endpoint}: ${metric.responseTime}ms`,
        description: `Response time exceeded threshold (${thresholds.responseTime}ms)`,
        endpoint: metric.endpoint
      });
    }

    // 5xx errors
    if (metric.statusCode >= 500) {
      await detectOrUpdateIssue(project, {
        type: 'crash',
        severity: 'critical',
        title: `HTTP ${metric.statusCode} on ${metric.method} ${metric.endpoint}`,
        description: `Server error detected`,
        endpoint: metric.endpoint
      });
    }

    // High memory usage / potential leak
    if (metric.memoryUsage && metric.memoryUsage > thresholds.memoryUsage) {
      await detectOrUpdateIssue(project, {
        type: 'memory_leak',
        severity: metric.memoryUsage > 95 ? 'critical' : 'high',
        title: `High memory usage: ${metric.memoryUsage}%`,
        description: `Memory usage exceeded threshold (${thresholds.memoryUsage}%)${metric.cpuUsage ? `, CPU at ${metric.cpuUsage}%` : ''}`,
        endpoint: metric.endpoint
      });
    }

    // Sequence/behavior detection (DDoS, scanning, brute force, credential stuffing)
    // — needs clientIp, which only agents on the updated middleware send. No-op,
    // not an error, for requests/agents without it.
    if (metric.clientIp) {
      const findings = recordAndCheck({
        projectId, clientIp: metric.clientIp, endpoint: metric.endpoint, statusCode: metric.statusCode
      });
      for (const finding of findings) {
        await detectOrUpdateIssue(project, finding);
      }
    }
  }

  // Update health score
  await updateHealthScore(project);
};

// Classifies a raw HTTP request via the ML service (Groq fallback if it's down) and
// raises an 'anomaly' issue when the verdict clears the confidence threshold. Only runs
// when the caller actually has raw request data to classify (see routes/ingest.js) —
// most agents today don't send this, so this is a no-op for them, not an error.
const analyzeRequestWithML = async (project, requestFields) => {
  try {
    const result = await classifyWebRequest(requestFields);
    if (!result.confident) return;

    const from = requestFields.clientIp ? ` from ${requestFields.clientIp}` : '';
    await detectOrUpdateIssue(project, {
      type: 'anomaly',
      severity: result.confidence > 0.95 ? 'critical' : 'high',
      title: `Suspicious request detected${from} (${result.source === 'ml-model' ? 'ML model' : 'Groq fallback'}): ${Math.round(result.confidence * 100)}% confidence`,
      description: result.reasoning || `Classified as ${result.label} by ${result.source}`,
      endpoint: requestFields.endpoint
    });
  } catch (err) {
    console.error('ML request analysis failed:', err.message);
  }
};

// Deterministic signature matching — runs on every rawRequest, independent of and
// in addition to the ML/Groq layer above. Zero external dependency, so it's the one
// detector guaranteed to keep working even if the ML service AND Groq are both down.
// Remediation text is baked into the signature, not AI-generated, so it's present
// immediately regardless of AI service availability.
const analyzeRequestPatterns = async (project, requestFields) => {
  const matches = detectAttackPatterns(requestFields);
  const from = requestFields.clientIp ? ` from ${requestFields.clientIp}` : '';
  for (const sig of matches) {
    await detectOrUpdateIssue(project, {
      type: 'anomaly',
      severity: sig.severity,
      title: `${sig.label} detected${from} (pattern match)`,
      description: `Signature-based detection matched a known ${sig.label} pattern. How to fix: ${sig.remediation}`,
      endpoint: requestFields.endpoint
    });
  }
};

const detectOrUpdateIssue = async (project, issueData) => {
  const projectId = project.projectId;
  const windowMs = 5 * 60 * 1000; // 5-minute dedup window

  let issue = await Issue.findOne({
    projectId,
    type: issueData.type,
    endpoint: issueData.endpoint,
    resolved: false,
    lastSeen: { $gte: new Date(Date.now() - windowMs) }
  });

  if (issue) {
    issue.count += 1;
    issue.lastSeen = new Date();
    if (issueData.severity === 'critical') issue.severity = 'critical';
    await issue.save();
  } else {
    issue = await Issue.create({ projectId, ...issueData });

    // Emit new issue to UI
    emitToProject(projectId, 'issue-detected', issue);

    // Trigger AI analysis (server-side via Groq), fire-and-forget
    require('../models/Log').find({ projectId })
      .sort({ timestamp: -1 }).limit(20)
      .then(async (recentLogs) => {
        const analysis = await analyzeIssueWithAI(issue, recentLogs);
        issue.aiAnalysis = analysis;
        await issue.save();
        emitToProject(projectId, 'ai-analysis-result', {
          issueId: issue._id,
          ...analysis,
          timestamp: new Date()
        });
      })
      .catch(err => console.error('AI analysis failed:', err.message));

    // Create alert for critical/high
    if (issue.severity === 'critical' || issue.severity === 'high') {
      await createAlert(project, issue);
    }
  }

  return issue;
};

const updateHealthScore = async (project) => {
  const projectId = project.projectId;
  const since = new Date(Date.now() - 60 * 60 * 1000);

  const [criticalIssues, highIssues, errorLogs, totalLogs] = await Promise.all([
    Issue.countDocuments({ projectId, severity: 'critical', resolved: false }),
    Issue.countDocuments({ projectId, severity: 'high', resolved: false }),
    require('../models/Log').countDocuments({ projectId, level: { $in: ['error', 'fatal'] }, timestamp: { $gte: since } }),
    require('../models/Log').countDocuments({ projectId, timestamp: { $gte: since } })
  ]);

  let score = 100;
  score -= criticalIssues * 20;
  score -= highIssues * 10;
  const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;
  score -= Math.min(errorRate * 2, 30);
  score = Math.max(0, Math.min(100, Math.round(score)));

  const status = score >= 80 ? 'active' : score >= 50 ? 'warning' : 'critical';

  await Project.findByIdAndUpdate(project._id, { healthScore: score, status });
  emitToProject(projectId, 'health-update', { healthScore: score, status });
};

const startWatchers = () => {
  console.log('👁️  Watchers started');
  // Periodic threshold checks run every 5 minutes
  watcherInterval = setInterval(async () => {
    try {
      const projects = await Project.find({ status: { $ne: 'inactive' } });
      for (const project of projects) {
        await updateHealthScore(project);
      }
    } catch (err) {
      console.error('Watcher error:', err.message);
    }
  }, 5 * 60 * 1000);
};

const stopWatchers = () => {
  if (watcherInterval) clearInterval(watcherInterval);
};

module.exports = {
  analyzeIssues, analyzeRequestWithML, analyzeRequestPatterns,
  startWatchers, stopWatchers, updateHealthScore
};
