// Seeds a demo user/team/project with sample logs, metrics, and an issue for local dev.
// Run with: npm run seed

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Team = require('../models/Team');
const Project = require('../models/Project');
const Log = require('../models/Log');
const Metric = require('../models/Metric');
const Issue = require('../models/Issue');

const DEMO_EMAIL = 'demo@autoqual.dev';
const DEMO_PASSWORD = 'demo1234';

const LOG_LEVELS = ['info', 'info', 'info', 'warn', 'error'];
const ENDPOINTS = [
  { method: 'GET', endpoint: '/api/users' },
  { method: 'POST', endpoint: '/api/orders' },
  { method: 'GET', endpoint: '/api/products' },
  { method: 'POST', endpoint: '/api/auth/login' }
];

const randomFrom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/autoqual');
  console.log('Connected to MongoDB');

  // Clear any previous demo data so this script is safe to re-run
  const existingUser = await User.findOne({ email: DEMO_EMAIL });
  if (existingUser) {
    const teams = await Team.find({ owner: existingUser._id });
    const teamIds = teams.map(t => t._id);
    const projects = await Project.find({ team: { $in: teamIds } });
    const projectIds = projects.map(p => p.projectId);

    await Log.deleteMany({ projectId: { $in: projectIds } });
    await Metric.deleteMany({ projectId: { $in: projectIds } });
    await Issue.deleteMany({ projectId: { $in: projectIds } });
    await Project.deleteMany({ _id: { $in: projects.map(p => p._id) } });
    await Team.deleteMany({ _id: { $in: teamIds } });
    await User.deleteOne({ _id: existingUser._id });
    console.log('Cleared previous demo data');
  }

  const user = await User.create({
    name: 'Demo User',
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD
  });

  const team = await Team.create({
    name: 'Demo Team',
    owner: user._id,
    members: [{ user: user._id, email: user.email, role: 'owner' }]
  });
  user.teams.push(team._id);
  await user.save();

  const project = await Project.create({
    name: 'Demo API Service',
    description: 'Seeded demo project for local development',
    baseUrl: 'http://localhost:4000',
    team: team._id,
    owner: user._id,
    alertEmail: user.email
  });
  team.projects.push(project._id);
  await team.save();

  const projectId = project.projectId;
  const now = Date.now();

  // 24h of sample logs, roughly one every 10 minutes
  const logs = [];
  for (let i = 0; i < 144; i++) {
    const { method, endpoint } = randomFrom(ENDPOINTS);
    logs.push({
      projectId,
      level: randomFrom(LOG_LEVELS),
      message: `${method} ${endpoint} handled`,
      endpoint,
      timestamp: new Date(now - i * 10 * 60 * 1000),
      source: 'seed'
    });
  }
  await Log.insertMany(logs);

  // Matching metrics
  const metrics = [];
  for (let i = 0; i < 144; i++) {
    const { method, endpoint } = randomFrom(ENDPOINTS);
    const statusCode = Math.random() < 0.08 ? 500 : Math.random() < 0.15 ? 404 : 200;
    metrics.push({
      projectId,
      endpoint,
      method,
      statusCode,
      responseTime: Math.round(80 + Math.random() * 400),
      requestCount: 1,
      errorCount: statusCode >= 400 ? 1 : 0,
      timestamp: new Date(now - i * 10 * 60 * 1000)
    });
  }
  await Metric.insertMany(metrics);

  // One sample issue so the dashboard isn't empty
  await Issue.create({
    projectId,
    type: 'slow_response',
    severity: 'medium',
    title: 'Slow response on GET /api/products',
    description: 'Response time exceeded threshold (2000ms)',
    endpoint: '/api/products',
    count: 3
  });

  console.log('\nSeed complete.\n');
  console.log('Demo login:');
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
  console.log('\nDemo project:');
  console.log(`  API Key:    ${project.apiKey}`);
  console.log(`  Project ID: ${project.projectId}\n`);

  await mongoose.disconnect();
};

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
