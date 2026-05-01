const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Team = require('../models/Team');
const User = require('../models/User');

// GET /api/teams
router.get('/', protect, async (req, res) => {
  try {
    const teams = await Team.find({
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }]
    }).populate('owner', 'name email').populate('projects');
    res.json({ teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams
router.post('/', protect, async (req, res) => {
  try {
    const { name, members = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'Team name required' });

    const team = await Team.create({
      name,
      owner: req.user._id,
      members: [{ user: req.user._id, email: req.user.email, role: 'owner' }]
    });

    // Add additional members by email
    for (const email of members) {
      const member = await User.findOne({ email });
      if (member) {
        team.members.push({ user: member._id, email: member.email, role: 'member' });
        member.teams.push(team._id);
        await member.save();
      }
    }
    await team.save();

    req.user.teams.push(team._id);
    await req.user.save();

    res.status(201).json({ team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('projects')
      .populate('members.user', 'name email');
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json({ team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/teams/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const team = await Team.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { name: req.body.name },
      { new: true }
    );
    if (!team) return res.status(404).json({ error: 'Team not found or unauthorized' });
    res.json({ team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams/:id/invite
router.post('/:id/invite', protect, async (req, res) => {
  try {
    const { email } = req.body;
    const team = await Team.findOne({ _id: req.params.id, owner: req.user._id });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const member = await User.findOne({ email });
    if (!member) return res.status(404).json({ error: 'User not found' });

    const alreadyMember = team.members.some(m => m.email === email);
    if (alreadyMember) return res.status(409).json({ error: 'Already a member' });

    team.members.push({ user: member._id, email: member.email, role: 'member' });
    await team.save();

    res.json({ message: 'Member added', team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
