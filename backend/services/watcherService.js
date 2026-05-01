const Issue = require('../models/Issue');
const Project = require('../models/Project');
const { emitToProject } = require('../socket/socketHandler');
const { createAlert } = require('./alertService');
const { buildIssuePrompt } = require('./aiService');

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
  }

  // Update health score
  await updateHealthScore(project);
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

    // Trigger AI analysis request to UI
    const recentLogs = await require('../models/Log').find({ projectId })
      .sort({ timestamp: -1 }).limit(20);
    const aiPrompt = buildIssuePrompt(issue, recentLogs);
    emitToProject(projectId, 'ai-analysis-request', {
      issueId: issue._id,
      prompt: aiPrompt
    });

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

module.exports = { analyzeIssues, startWatchers, stopWatchers, updateHealthScore };
