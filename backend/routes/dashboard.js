const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Log = require('../models/Log');
const Metric = require('../models/Metric');
const Issue = require('../models/Issue');
const Alert = require('../models/Alert');
const Project = require('../models/Project');
const { generateLiveSummary } = require('../services/aiService');

// GET /api/dashboard/:projectId/overview
router.get('/:projectId/overview', protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

    const [
      totalLogs, errorLogs, warnLogs,
      totalMetrics, activeIssues, unreadAlerts,
      project
    ] = await Promise.all([
      Log.countDocuments({ projectId, timestamp: { $gte: since } }),
      Log.countDocuments({ projectId, level: { $in: ['error', 'fatal'] }, timestamp: { $gte: since } }),
      Log.countDocuments({ projectId, level: 'warn', timestamp: { $gte: since } }),
      Metric.countDocuments({ projectId, timestamp: { $gte: since } }),
      Issue.countDocuments({ projectId, resolved: false }),
      Alert.countDocuments({ projectId, read: false }),
      Project.findOne({ projectId })
    ]);

    // Avg response time
    const avgResponseTimeAgg = await Metric.aggregate([
      { $match: { projectId, timestamp: { $gte: since }, responseTime: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$responseTime' }, p95: { $percentile: { input: '$responseTime', p: [0.95], method: 'approximate' } } } }
    ]);
    const avgResponseTime = avgResponseTimeAgg[0]?.avg || 0;

    // Error rate
    const errorRate = totalMetrics > 0 ? ((await Metric.countDocuments({ projectId, statusCode: { $gte: 400 }, timestamp: { $gte: since } })) / totalMetrics * 100) : 0;

    res.json({
      totalLogs, errorLogs, warnLogs,
      totalRequests: totalMetrics,
      avgResponseTime: Math.round(avgResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
      activeIssues,
      unreadAlerts,
      healthScore: project?.healthScore ?? 100,
      status: project?.status || 'active',
      lastSeen: project?.lastSeen
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/:projectId/logs
router.get('/:projectId/logs', protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 100, level, since } = req.query;
    const query = { projectId };
    if (level) query.level = level;
    if (since) query.timestamp = { $gte: new Date(since) };

    const logs = await Log.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit));
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/:projectId/metrics
router.get('/:projectId/metrics', protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const since = new Date(Date.now() - 60 * 60 * 1000); // last 1h

    const metrics = await Metric.find({ projectId, timestamp: { $gte: since } })
      .sort({ timestamp: -1 })
      .limit(500);

    // Endpoint breakdown
    const endpointStats = await Metric.aggregate([
      { $match: { projectId, timestamp: { $gte: since } } },
      {
        $group: {
          _id: { endpoint: '$endpoint', method: '$method' },
          count: { $sum: '$requestCount' },
          avgResponseTime: { $avg: '$responseTime' },
          errorCount: { $sum: '$errorCount' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    res.json({ metrics, endpointStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/:projectId/issues
router.get('/:projectId/issues', protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { resolved = 'false', limit = 20 } = req.query;
    const issues = await Issue.find({ projectId, resolved: resolved === 'true' })
      .sort({ lastSeen: -1 })
      .limit(Number(limit));
    res.json({ issues });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/dashboard/:projectId/issues/:issueId/resolve
router.put('/:projectId/issues/:issueId/resolve', protect, async (req, res) => {
  try {
    const issue = await Issue.findByIdAndUpdate(
      req.params.issueId,
      { resolved: true, resolvedAt: new Date() },
      { new: true }
    );
    if (!issue) return res.status(404).json({ error: 'Issue not found' });
    res.json({ issue });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/:projectId/chart-data
router.get('/:projectId/chart-data', protect, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - Number(hours) * 60 * 60 * 1000);

    const logsByHour = await Log.aggregate([
      { $match: { projectId, timestamp: { $gte: since } } },
      {
        $group: {
          _id: {
            hour: { $dateToString: { format: '%Y-%m-%dT%H:00:00.000Z', date: '$timestamp' } },
            level: '$level'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.hour': 1 } }
    ]);

    const responseTimeByHour = await Metric.aggregate([
      { $match: { projectId, timestamp: { $gte: since }, responseTime: { $exists: true } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%dT%H:00:00.000Z', date: '$timestamp' } },
          avgResponseTime: { $avg: '$responseTime' },
          count: { $sum: '$requestCount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ logsByHour, responseTimeByHour });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dashboard/:projectId/ai-summary
router.post('/:projectId/ai-summary', protect, async (req, res) => {
  try {
    const { overview, topIssues = [] } = req.body;
    const summary = await generateLiveSummary(overview, topIssues);
    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
