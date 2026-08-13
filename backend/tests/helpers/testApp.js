// Boots the real Express app against an isolated test database.
// Must be required before anything else touches process.env in a test file.

process.env.MONGODB_URI = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/autoqual_test';
process.env.PORT = 0;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_ci';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'test-key-not-called';

const mongoose = require('mongoose');
const { app } = require('../../server');

const waitForDb = () => new Promise((resolve, reject) => {
  if (mongoose.connection.readyState === 1) return resolve();
  mongoose.connection.once('connected', resolve);
  mongoose.connection.once('error', reject);
});

module.exports = { app, mongoose, waitForDb };
