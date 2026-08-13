const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Project = require('../models/Project');
const Team = require('../models/Team');

// GET /api/projects
router.get('/', protect, async (req, res) => {
  try {
    const teams = await Team.find({
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }]
    });
    const teamIds = teams.map(t => t._id);
    const projects = await Project.find({ team: { $in: teamIds } })
      .populate('team', 'name')
      .populate('owner', 'name email')
      .sort({ updatedAt: -1 });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, baseUrl, teamId, endpoints = [], serviceMap = [], alertEmail, alertThresholds } = req.body;
    if (!name || !baseUrl || !teamId) {
      return res.status(400).json({ error: 'name, baseUrl, teamId are required' });
    }

    const team = await Team.findOne({
      _id: teamId,
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }]
    });
    if (!team) return res.status(403).json({ error: 'Team not found or unauthorized' });

    const project = await Project.create({
      name, description, baseUrl, team: teamId, owner: req.user._id,
      endpoints, serviceMap,
      alertEmail: alertEmail || req.user.email,
      ...(alertThresholds && { alertThresholds })
    });

    team.projects.push(project._id);
    await team.save();

    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('team', 'name members')
      .populate('owner', 'name email');
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, description, baseUrl, endpoints, serviceMap, alertEmail, alertThresholds } = req.body;
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { name, description, baseUrl, endpoints, serviceMap, alertEmail, alertThresholds },
      { new: true, runValidators: true }
    );
    if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });
    await Team.updateOne({ _id: project.team }, { $pull: { projects: project._id } });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/regenerate-key
router.post('/:id/regenerate-key', protect, async (req, res) => {
  try {
    const { randomUUID } = require('crypto');
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { apiKey: `aq_${randomUUID().replace(/-/g, '')}` },
      { new: true }
    );
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ apiKey: project.apiKey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
