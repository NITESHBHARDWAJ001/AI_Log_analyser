const Project = require('../models/Project');

const agentAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key' });
  }
  const apiKey = authHeader.split(' ')[1];
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: 'projectId required' });
  }

  try {
    const project = await Project.findOne({ apiKey, projectId });
    if (!project) {
      return res.status(401).json({ error: 'Invalid API key or project ID' });
    }
    req.project = project;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Auth error' });
  }
};

module.exports = { agentAuth };
