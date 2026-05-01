const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  projectId: { type: String, required: true, index: true },
  level: { type: String, enum: ['info', 'warn', 'error', 'debug', 'fatal'], default: 'info' },
  message: { type: String, required: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  endpoint: { type: String },
  traceFile: { type: String },
  traceLine: { type: Number },
  timestamp: { type: Date, default: Date.now, index: true },
  source: { type: String, default: 'agent' }
}, { timestamps: false });

logSchema.index({ projectId: 1, timestamp: -1 });
logSchema.index({ projectId: 1, level: 1 });

module.exports = mongoose.model('Log', logSchema);
