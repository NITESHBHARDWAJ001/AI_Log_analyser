const Issue = require('../models/Issue');
const Project = require('../models/Project');
const { emitToProject } = require('../socket/socketHandler');
const { createAlert } = require('./alertService');
const { analyzeIssueWithAI } = require('./aiService');
const { classifyWebRequest, classifySecurityEvent } = require('./mlService');
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

// Weighted ensemble of the two request-level detectors: deterministic pattern
// matching (always available, zero external dependency) and the ML/Groq layer
// (may be unavailable). 50/50 when both are available; the pattern layer alone
// carries 100% of the weight when the ML layer is unreachable, so detection
// degrades gracefully instead of going dark. This also makes the whole system
// more stable against the ML model's known calibration limits (see
// notebooks/retrain_web_attack_augmented.py) — a lone weak ML guess can't fire
// an alert without either corroboration from the deterministic layer or being
// extremely confident on its own.
const PATTERN_WEIGHT = Number(process.env.PATTERN_DETECTION_WEIGHT) || 0.5;
const ML_WEIGHT = Number(process.env.ML_DETECTION_WEIGHT) || 0.5;
// Deliberately below PATTERN_WEIGHT (0.5) — a deterministic signature match should
// clear the bar with margin, not sit exactly on the boundary where float rounding
// or a future weight tweak could flip it.
const COMBINED_ALERT_THRESHOLD = Number(process.env.COMBINED_ALERT_THRESHOLD) || 0.45;

// classifyWebRequest's `confidence` field means different things depending on
// `source` (see mlService.js) — this normalizes both into one 0-1 "probability
// this request is an attack", regardless of which label was actually predicted.
const toAnomalousProbability = (mlResult) => {
  if (mlResult.source === 'unavailable') return null;
  if (mlResult.source === 'ml-model') return mlResult.confidence; // already anomalous-probability
  // groq-fallback: `confidence` is Groq's confidence in whichever label it picked
  return mlResult.isAnomalous ? mlResult.confidence : (1 - mlResult.confidence);
};

const analyzeRequestEnsemble = async (project, requestFields) => {
  try {
    const patternMatches = detectAttackPatterns(requestFields);
    const patternScore = patternMatches.length > 0 ? 1 : 0;
    const topSignature = patternMatches[0];

    const mlResult = await classifyWebRequest(requestFields);
    const mlProbability = toAnomalousProbability(mlResult);
    const mlAvailable = mlProbability !== null;

    const combinedScore = mlAvailable
      ? PATTERN_WEIGHT * patternScore + ML_WEIGHT * mlProbability
      : patternScore; // ML down -> pattern layer alone carries full weight

    if (combinedScore < COMBINED_ALERT_THRESHOLD) return;

    const from = requestFields.clientIp ? ` from ${requestFields.clientIp}` : '';
    const scorePct = Math.round(combinedScore * 100);
    const sourceLabel = !mlAvailable
      ? 'pattern-only, ML unavailable'
      : (mlResult.source === 'ml-model' ? 'ML model' : 'Groq fallback');

    let title;
    let description;
    if (topSignature) {
      title = `${topSignature.label} detected${from} (${scorePct}% combined confidence)`;
      description = `Signature-based detection matched a known ${topSignature.label} pattern` +
        (mlAvailable ? `, corroborated by ${sourceLabel} at ${Math.round(mlProbability * 100)}% anomalous probability` : ` (${sourceLabel})`) +
        `. How to fix: ${topSignature.remediation}`;
    } else {
      title = `Suspicious request detected${from} (${sourceLabel}, ${scorePct}% combined confidence)`;
      description = mlResult.reasoning || `Classified as ${mlResult.label} by ${sourceLabel}`;
    }

    await detectOrUpdateIssue(project, {
      type: 'anomaly',
      severity: combinedScore > 0.9 ? 'critical' : 'high',
      title,
      description,
      endpoint: requestFields.endpoint
    });
  } catch (err) {
    console.error('Request ensemble analysis failed:', err.message);
  }
};

// Multi-class security-event model (organization_y_event_classifier) — classifies a
// single log line into benign / bruteforce / scanning / file-inclusion / CyberPanel
// admin-panel categories. Runs on every ingested log; the model's own confidence gate
// (benign is never "confident") keeps this from spamming issues on normal traffic.
const SECURITY_EVENT_TYPE_MAP = {
  bruteforce_login_server_attempt: 'bruteforce',
  bruteforce_login_web: 'bruteforce',
  dir_scan: 'scanning',
  file_inclusion: 'anomaly',
  cyberpanel_login_attempt: 'anomaly',
  cyberpanel_login_success: 'anomaly'
};

const analyzeLogWithML = async (project, log) => {
  if (!log.message) return;
  try {
    const result = await classifySecurityEvent({
      message: log.message,
      logType: log.logType || 'agent',
      clientIp: log.clientIp
    });
    if (!result.confident) return;

    const issueType = SECURITY_EVENT_TYPE_MAP[result.label] || 'anomaly';
    const readable = result.label.replace(/_/g, ' ');
    const from = log.clientIp ? ` from ${log.clientIp}` : '';
    const isCompromise = result.label === 'cyberpanel_login_success';

    await detectOrUpdateIssue(project, {
      type: issueType,
      severity: isCompromise ? 'critical' : (result.confidence > 0.95 ? 'high' : 'medium'),
      title: `${readable} detected${from} (${result.source === 'ml-model' ? 'ML model' : 'Groq fallback'})`,
      description: result.reasoning || `Log classified as "${result.label}" with ${Math.round(result.confidence * 100)}% confidence`,
      endpoint: log.endpoint
    });
  } catch (err) {
    console.error('Security-event ML analysis failed:', err.message);
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
  analyzeIssues, analyzeRequestEnsemble, analyzeLogWithML,
  startWatchers, stopWatchers, updateHealthScore
};
