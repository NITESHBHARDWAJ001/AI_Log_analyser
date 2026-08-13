const mongoose = require('mongoose');

const metricSchema = new mongoose.Schema({
  projectId: { type: String, required: true, index: true },
  endpoint: { type: String },
  method: { type: String },
  statusCode: { type: Number },
  clientIp: { type: String },
  responseTime: { type: Number },
  memoryUsage: { type: Number },
  cpuUsage: { type: Number },
  requestCount: { type: Number, default: 1 },
  errorCount: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: false });

metricSchema.index({ projectId: 1, timestamp: -1 });
metricSchema.index({ projectId: 1, endpoint: 1 });

module.exports = mongoose.model('Metric', metricSchema);
