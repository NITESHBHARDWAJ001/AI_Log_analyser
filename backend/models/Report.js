const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  projectId: { type: String, required: true, index: true },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  period: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  stats: {
    totalLogs: { type: Number, default: 0 },
    errorLogs: { type: Number, default: 0 },
    warnLogs: { type: Number, default: 0 },
    totalRequests: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 },
    errorRate: { type: Number, default: 0 },
    issueCount: { type: Number, default: 0 },
    resolvedIssues: { type: Number, default: 0 },
    healthScore: { type: Number, default: 100 }
  },
  topIssues: [{ type: mongoose.Schema.Types.Mixed }],
  aiSummary: { type: String },
  emailSent: { type: Boolean, default: false },
  generatedAt: { type: Date, default: Date.now }
}, { timestamps: false });

module.exports = mongoose.model('Report', reportSchema);
