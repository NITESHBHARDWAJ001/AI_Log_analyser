'use strict';

const { loadConfig } = require('../config');
const { Sender } = require('../../sender');

module.exports = async () => {
  const config = loadConfig();
  if (!config) {
    console.error('\n✗ No .autoqual.json found. Run: npx autoqual init\n');
    process.exit(1);
  }

  console.log(`\nConnecting to: ${config.backendUrl}`);
  console.log(`Project: ${config.projectId}\n`);

  const sender = new Sender({
    apiKey: config.apiKey,
    projectId: config.projectId,
    backendUrl: config.backendUrl,
    debug: false
  });

  try {
    const health = await sender.testConnection();
    console.log('✓ Backend reachable');

    // Send a connection test log
    await sender.send({
      logs: [{ level: 'info', message: 'AutoQual agent connected via CLI', timestamp: new Date().toISOString() }],
      metrics: []
    });
    console.log('✓ Ingest API authenticated');
    console.log('\n🎉 Connection successful! Open your dashboard to see the test log.\n');
  } catch (err) {
    console.error(`\n✗ Connection failed: ${err.message}`);
    if (err.response?.status === 401) {
      console.error('  → Invalid API key or project ID. Check your .autoqual.json\n');
    } else {
      console.error(`  → Is the backend running at ${config.backendUrl}?\n`);
    }
    process.exit(1);
  }
};
