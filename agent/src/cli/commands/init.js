'use strict';

const readline = require('readline');
const { saveConfig } = require('../config');

const ask = (rl, question) => new Promise(resolve => rl.question(question, resolve));

module.exports = async () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   AutoQual AI+  —  Setup Wizard      ║');
  console.log('╚══════════════════════════════════════╝\n');
  console.log('Get your API Key and Project ID from: https://autoqual.dev/dashboard\n');

  try {
    const apiKey     = await ask(rl, '  API Key       (aq_...): ');
    const projectId  = await ask(rl, '  Project ID    (proj_...): ');
    const baseUrl    = await ask(rl, '  App Base URL  (e.g. https://api.myapp.com): ');
    const backendUrl = await ask(rl, '  Backend URL   [http://localhost:5000]: ') || 'http://localhost:5000';

    const config = {
      apiKey: apiKey.trim(),
      projectId: projectId.trim(),
      baseUrl: baseUrl.trim(),
      backendUrl: backendUrl.trim()
    };

    if (!config.apiKey || !config.projectId) {
      console.error('\n✗ API Key and Project ID are required.\n');
      process.exit(1);
    }

    saveConfig(config);
    console.log('\n✓ Config saved to .autoqual.json');
    console.log('\nNext step — test your connection:');
    console.log('  npx autoqual connect\n');
  } finally {
    rl.close();
  }
};
