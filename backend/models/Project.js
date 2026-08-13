const mongoose = require('mongoose');
const { randomUUID } = require('crypto');

const endpointSchema = new mongoose.Schema({
  method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
  path: { type: String, required: true },
  description: { type: String }
});

const serviceMapEntrySchema = new mongoose.Schema({
  endpoint: { type: String },
  file: { type: String },
  line: { type: Number }
});

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  baseUrl: { type: String, required: true },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  apiKey: { type: String, unique: true, default: () => `aq_${randomUUID().replace(/-/g, '')}` },
  projectId: { type: String, unique: true, default: () => `proj_${randomUUID().replace(/-/g, '').slice(0, 16)}` },
  endpoints: [endpointSchema],
  serviceMap: [serviceMapEntrySchema],
  healthScore: { type: Number, default: 100, min: 0, max: 100 },
  status: { type: String, enum: ['active', 'inactive', 'warning', 'critical'], default: 'active' },
  lastSeen: { type: Date },
  alertEmail: { type: String },
  alertThresholds: {
    errorRate: { type: Number, default: 5 },
    responseTime: { type: Number, default: 2000 },
    logErrorCount: { type: Number, default: 10 },
    memoryUsage: { type: Number, default: 85 }
  }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
