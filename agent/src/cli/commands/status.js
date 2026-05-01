'use strict';

const { loadConfig } = require('../config');
const axios = require('axios');

module.exports = async () => {
  const config = loadConfig();
  if (!config) {
    console.error('\n✗ No .autoqual.json found. Run: npx autoqual init\n');
    process.exit(1);
  }

  console.log(`\n📊 Project Status — ${config.projectId}\n`);

  try {
    const client = axios.create({
      baseURL: config.backendUrl,
      timeout: 8000,
      headers: { 'Content-Type': 'application/json' }
    });

    // We don't have a JWT here so we just check backend health
    const health = await client.get('/health');
    console.log(`Backend:    ✓ ${config.backendUrl} (${health.data.status})`);
    console.log(`Project ID: ${config.projectId}`);
    console.log(`API Key:    ${config.apiKey.slice(0, 8)}...`);
    console.log(`Base URL:   ${config.baseUrl}`);
    console.log('\nFor full stats, open: /dashboard/' + config.projectId + '\n');
  } catch (err) {
    console.error(`\n✗ Backend unreachable: ${err.message}\n`);
    process.exit(1);
  }
};
