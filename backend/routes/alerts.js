const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Alert = require('../models/Alert');
const Project = require('../models/Project');

// GET /api/alerts?projectId=xxx
router.get('/', protect, async (req, res) => {
  try {
    const { projectId, limit = 50, unreadOnly } = req.query;
    const query = {};
    if (projectId) query.projectId = projectId;
    if (unreadOnly === 'true') query.read = false;

    const alerts = await Alert.find(query)
      .sort({ timestamp: -1 })
      .limit(Number(limit));
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/alerts/:id/read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/alerts/mark-all-read
router.put('/mark-all-read', protect, async (req, res) => {
  try {
    const { projectId } = req.body;
    const query = { read: false };
    if (projectId) query.projectId = projectId;
    await Alert.updateMany(query, { read: true });
    res.json({ message: 'All alerts marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
