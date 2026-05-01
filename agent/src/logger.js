const { AutoQualAgent } = require('./agent');

const logger = {
  info:  (message, meta = {}) => AutoQualAgent.log('info',  message, meta),
  warn:  (message, meta = {}) => AutoQualAgent.log('warn',  message, meta),
  error: (message, meta = {}) => AutoQualAgent.log('error', message, meta),
  debug: (message, meta = {}) => AutoQualAgent.log('debug', message, meta),
  fatal: (message, meta = {}) => AutoQualAgent.log('fatal', message, meta)
};

module.exports = { logger };
