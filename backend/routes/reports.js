const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Report = require('../models/Report');
const { generateReport } = require('../services/reportService');

// GET /api/reports?projectId=xxx
router.get('/', protect, async (req, res) => {
  try {
    const { projectId, limit = 10 } = req.query;
    const query = {};
    if (projectId) query.projectId = projectId;

    const reports = await Report.find(query)
      .sort({ generatedAt: -1 })
      .limit(Number(limit));
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/reports/generate (manual trigger)
router.post('/generate', protect, async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });
    const report = await generateReport(projectId);
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
