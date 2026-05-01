'use strict';

const { loadConfig } = require('../config');
const { Sender } = require('../../sender');

module.exports = async () => {
  const config = loadConfig();
  if (!config) {
    console.error('\n✗ No .autoqual.json found. Run: npx autoqual init\n');
    process.exit(1);
  }

  console.log('\n🧪 Sending test data...\n');

  const sender = new Sender({
    apiKey: config.apiKey,
    projectId: config.projectId,
    backendUrl: config.backendUrl,
    debug: true
  });

  const ts = new Date().toISOString();

  try {
    await sender.send({
      logs: [
        { level: 'info',  message: 'Test log: AutoQual CLI send-test',              timestamp: ts },
        { level: 'warn',  message: 'Test warn: Simulated warning from CLI',          timestamp: ts },
        { level: 'error', message: 'Test error: Simulated error from CLI (safe)',    timestamp: ts }
      ],
      metrics: [
        { endpoint: '/test', method: 'GET', statusCode: 200, responseTime: 123, requestCount: 1, timestamp: ts }
      ]
    });

    console.log('\n✓ Test data sent successfully!');
    console.log('  Open your dashboard to see the test logs.\n');
  } catch (err) {
    console.error(`\n✗ Failed: ${err.message}\n`);
    process.exit(1);
  }
};
