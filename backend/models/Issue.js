const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  projectId: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: [
      'error_spike', 'slow_response', 'memory_leak', 'crash', 'anomaly', 'threshold_breach',
      'ddos', 'scanning', 'bruteforce', 'credential_stuffing'
    ],
    required: true
  },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  title: { type: String, required: true },
  description: { type: String },
  endpoint: { type: String },
  traceFile: { type: String },
  traceLine: { type: Number },
  aiAnalysis: {
    rootCause: { type: String },
    suggestion: { type: String },
    codeSnippet: { type: String },
    summary: { type: String }
  },
  resolved: { type: Boolean, default: false },
  resolvedAt: { type: Date },
  count: { type: Number, default: 1 },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now }
}, { timestamps: true });

issueSchema.index({ projectId: 1, resolved: 1, lastSeen: -1 });

module.exports = mongoose.model('Issue', issueSchema);
