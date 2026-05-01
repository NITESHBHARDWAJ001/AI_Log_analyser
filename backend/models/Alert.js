const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  projectId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
  message: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed },
  emailSent: { type: Boolean, default: false },
  read: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: false });

alertSchema.index({ projectId: 1, read: 1, timestamp: -1 });

module.exports = mongoose.model('Alert', alertSchema);
