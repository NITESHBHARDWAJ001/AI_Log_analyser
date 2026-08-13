const { Sender } = require('./sender');
const { hookConsole } = require('./logHook');
const { Metrics } = require('./metrics');

class AutoQualAgentClass {
  constructor() {
    this._initialized = false;
    this._config = {};
    this._sender = null;
    this._metrics = null;
    this._pendingLogs = [];
    this._pendingMetrics = [];
    this._flushTimer = null;
  }

  init(config = {}) {
    if (this._initialized) return this;

    const {
      apiKey,
      projectId,
      baseUrl = '',
      backendUrl = 'http://localhost:5000',
      flushInterval = 5000,
      maxBatchSize = 50,
      hookConsole: shouldHookConsole = true,
      reportSystemMetrics = true,
      // Opt-in: sends method/headers/body/query per request to the backend's ML
      // threat-detection pipeline. Off by default because it can carry sensitive
      // data (form fields, tokens in headers) — read the redact* options below
      // before turning this on.
      captureRawRequests = false,
      // Fraction of requests to capture when captureRawRequests is on (0-1).
      // Lower this on high-traffic apps to control ingest volume/cost.
      captureRawRequestsSampleRate = 1,
      // Header names (lowercase) stripped before anything is sent.
      redactHeaders = ['authorization', 'cookie', 'set-cookie'],
      // Body field names (case-insensitive substring match) whose values are
      // replaced with '[REDACTED]' before the body is sent, at any nesting depth.
      redactBodyFields = ['password', 'pass', 'pwd', 'token', 'secret', 'apikey', 'ssn', 'creditcard', 'cvv'],
      debug = false
    } = config;

    if (!apiKey) throw new Error('[AutoQual] apiKey is required');
    if (!projectId) throw new Error('[AutoQual] projectId is required');

    this._config = {
      apiKey, projectId, baseUrl, backendUrl, flushInterval, maxBatchSize, reportSystemMetrics,
      captureRawRequests, captureRawRequestsSampleRate, redactHeaders, redactBodyFields, debug
    };
    this._sender = new Sender({ apiKey, projectId, backendUrl, debug });
    this._metrics = new Metrics();
    this._initialized = true;

    if (shouldHookConsole) {
      hookConsole((level, message, meta) => this._queueLog(level, message, meta));
    }

    this._flushTimer = setInterval(() => {
      if (this._config.reportSystemMetrics) this._sampleSystemMetrics();
      this._flush();
    }, flushInterval);
    if (this._flushTimer.unref) this._flushTimer.unref();

    if (debug) console.log(`[AutoQual] Initialized — project: ${projectId}`);
    return this;
  }

  _queueLog(level, message, meta = {}, endpoint = null, rawRequest = null) {
    if (!this._initialized) return;
    const entry = { level, message, meta, endpoint, timestamp: new Date().toISOString() };
    if (rawRequest) entry.rawRequest = rawRequest;
    this._pendingLogs.push(entry);
    if (this._pendingLogs.length >= this._config.maxBatchSize) {
      this._flush();
    }
  }

  _queueMetric(data) {
    if (!this._initialized) return;
    this._pendingMetrics.push({ ...data, timestamp: data.timestamp || new Date().toISOString() });
  }

  _sampleSystemMetrics() {
    if (!this._metrics) return;
    this._queueMetric({
      memoryUsage: this._metrics.getMemoryUsagePercent(),
      cpuUsage: this._metrics.getCpuUsagePercent()
    });
  }

  async _flush() {
    if (!this._initialized) return;
    if (this._pendingLogs.length === 0 && this._pendingMetrics.length === 0) return;

    const logs = this._pendingLogs.splice(0);
    const metrics = this._pendingMetrics.splice(0);

    try {
      await this._sender.send({ logs, metrics });
    } catch (err) {
      if (this._config.debug) console.error('[AutoQual] Flush error:', err.message);
      // Re-queue on failure (bounded to prevent memory growth)
      if (this._pendingLogs.length < 200) {
        this._pendingLogs.unshift(...logs);
        this._pendingMetrics.unshift(...metrics);
      }
    }
  }

  async flush() {
    return this._flush();
  }

  log(level, message, meta = {}) {
    this._queueLog(level, message, meta);
  }

  destroy() {
    if (this._flushTimer) clearInterval(this._flushTimer);
    this._initialized = false;
  }

  getMetrics() {
    return this._metrics;
  }

  _getConfig() {
    return this._config;
  }

  _queueMetricFromMiddleware(data) {
    this._queueMetric(data);
  }
}

const AutoQualAgent = new AutoQualAgentClass();
module.exports = { AutoQualAgent, AutoQualAgentClass };
