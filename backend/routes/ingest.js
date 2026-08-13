const express = require('express');
const router = express.Router();
const { agentAuth } = require('../middleware/agentAuth');
const Log = require('../models/Log');
const Metric = require('../models/Metric');
const Project = require('../models/Project');
const { emitToProject } = require('../socket/socketHandler');
const { analyzeIssues, analyzeRequestWithML } = require('../services/watcherService');

// POST /api/ingest
router.post('/', agentAuth, async (req, res) => {
  try {
    const { projectId, logs = [], metrics = [], endpoint, timestamp } = req.body;
    const project = req.project;

    const savedLogs = [];
    const savedMetrics = [];

    // Process logs
    for (const log of logs) {
      const traceEntry = project.serviceMap?.find(sm => sm.endpoint === (log.endpoint || endpoint));
      const saved = await Log.create({
        projectId,
        level: log.level || 'info',
        message: log.message,
        meta: log.meta || {},
        endpoint: log.endpoint || endpoint,
        traceFile: traceEntry?.file,
        traceLine: traceEntry?.line,
        timestamp: log.timestamp || timestamp || new Date(),
        source: 'agent'
      });
      savedLogs.push(saved);
      emitToProject(projectId, 'log-update', saved);

      // Optional: agent can attach raw HTTP request fields for ML-based attack
      // detection (not persisted on the Log itself — used transiently here only).
      if (log.rawRequest) {
        analyzeRequestWithML(project, { ...log.rawRequest, endpoint: log.endpoint || endpoint })
          .catch(console.error);
      }
    }

    // Process metrics
    for (const metric of metrics) {
      const saved = await Metric.create({
        projectId,
        endpoint: metric.endpoint || endpoint,
        method: metric.method,
        statusCode: metric.statusCode,
        responseTime: metric.responseTime,
        memoryUsage: metric.memoryUsage,
        cpuUsage: metric.cpuUsage,
        requestCount: metric.requestCount || 1,
        errorCount: metric.statusCode >= 400 ? 1 : 0,
        timestamp: metric.timestamp || timestamp || new Date()
      });
      savedMetrics.push(saved);
      emitToProject(projectId, 'metrics-update', saved);
    }

    // Update project lastSeen
    await Project.findByIdAndUpdate(project._id, { lastSeen: new Date() });

    // Trigger watcher analysis (async, don't await)
    analyzeIssues(project, savedLogs, savedMetrics).catch(console.error);

    res.json({
      success: true,
      logsIngested: savedLogs.length,
      metricsIngested: savedMetrics.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
