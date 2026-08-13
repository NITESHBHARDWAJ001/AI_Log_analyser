const axios = require('axios');

class Sender {
  constructor({ apiKey, projectId, backendUrl, debug }) {
    this.apiKey = apiKey;
    this.projectId = projectId;
    this.backendUrl = backendUrl.replace(/\/$/, '');
    this.debug = debug;

    this.client = axios.create({
      baseURL: this.backendUrl,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': '@hr_71_sharma/agent'
      }
    });
  }

  async send({ logs = [], metrics = [] }) {
    if (!logs.length && !metrics.length) return;

    const payload = {
      projectId: this.projectId,
      logs,
      metrics,
      timestamp: new Date().toISOString()
    };

    if (this.debug) {
      console.log(`[AutoQual] Sending batch: ${logs.length} logs, ${metrics.length} metrics`);
    }

    const res = await this.client.post('/api/ingest', payload);
    return res.data;
  }

  async testConnection() {
    const res = await this.client.get('/health');
    return res.data;
  }
}

module.exports = { Sender };
