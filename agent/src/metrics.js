const os = require('os');

class Metrics {
  constructor() {
    this._counters = {};
    this._lastCpuUsage = process.cpuUsage();
    this._lastCpuTime = Date.now();
  }

  increment(key, value = 1) {
    this._counters[key] = (this._counters[key] || 0) + value;
  }

  get(key) {
    return this._counters[key] || 0;
  }

  reset() {
    this._counters = {};
  }

  snapshot() {
    return { ...this._counters, timestamp: new Date().toISOString() };
  }

  getMemoryUsage() {
    const mem = process.memoryUsage();
    return {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024)
    };
  }

  getCpuUsage() {
    const usage = process.cpuUsage();
    return {
      user: Math.round(usage.user / 1000),
      system: Math.round(usage.system / 1000)
    };
  }

  // % of total system RAM used by this process (rss-based — a steadily
  // climbing value here is the actual signal of a leak, unlike heapUsed/
  // heapTotal which is noisy due to GC and heap growth increments).
  getMemoryUsagePercent() {
    const mem = process.memoryUsage();
    return Math.round((mem.rss / os.totalmem()) * 100 * 100) / 100;
  }

  // % of one CPU core consumed since the last call (diff-based sampling).
  getCpuUsagePercent() {
    const now = Date.now();
    const elapsedMs = now - this._lastCpuTime;
    const diff = process.cpuUsage(this._lastCpuUsage);
    this._lastCpuUsage = process.cpuUsage();
    this._lastCpuTime = now;
    if (elapsedMs <= 0) return 0;
    const cpuMs = (diff.user + diff.system) / 1000;
    return Math.round((cpuMs / elapsedMs) * 100 * 100) / 100;
  }
}

module.exports = { Metrics };
