class Metrics {
  constructor() {
    this._counters = {};
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
}

module.exports = { Metrics };
