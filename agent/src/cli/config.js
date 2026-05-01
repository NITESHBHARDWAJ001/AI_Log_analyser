'use strict';

const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(process.cwd(), '.autoqual.json');

const loadConfig = () => {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveConfig = (config) => {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
};

module.exports = { loadConfig, saveConfig, CONFIG_FILE };
