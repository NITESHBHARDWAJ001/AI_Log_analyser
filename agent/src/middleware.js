const { AutoQualAgent } = require('./agent');

const REDACTED = '[REDACTED]';

// Redacts matching field names at any nesting depth, without mutating the original body.
const redactBody = (value, redactFields, depth = 0) => {
  if (depth > 5 || value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => redactBody(v, redactFields, depth + 1));

  const out = {};
  for (const [key, val] of Object.entries(value)) {
    const isSensitive = redactFields.some(f => key.toLowerCase().includes(f));
    out[key] = isSensitive ? REDACTED : redactBody(val, redactFields, depth + 1);
  }
  return out;
};

// Best-effort text form of the (redacted) request body — form-encoded for flat
// objects to resemble what the web-attack model trained on, JSON otherwise.
const serializeBody = (body, redactFields) => {
  if (body == null || body === '') return '';
  if (typeof body === 'string') return body;

  const redacted = redactBody(body, redactFields);
  try {
    if (typeof redacted === 'object' && !Array.isArray(redacted)) {
      const isFlat = Object.values(redacted).every(v => typeof v !== 'object' || v === null);
      if (isFlat) return new URLSearchParams(redacted).toString();
    }
    return JSON.stringify(redacted);
  } catch {
    return String(redacted);
  }
};

const getClientIp = (req) => {
  // req.ip respects Express's `trust proxy` setting (X-Forwarded-For) when the
  // host app has configured it; falls back to the raw socket address otherwise.
  return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '';
};

const buildRawRequest = (req, config) => {
  const headers = req.headers || {};
  const header = (name) => {
    if (config.redactHeaders.includes(name)) return '';
    return headers[name] || '';
  };
  const queryIdx = req.url?.indexOf('?') ?? -1;

  return {
    method: req.method,
    clientIp: config.captureClientIp !== false ? getClientIp(req) : '',
    hostHeader: req.httpVersion ? `HTTP/${req.httpVersion}` : '',
    connection: header('connection'),
    accept: header('accept'),
    acceptCharset: header('accept-charset'),
    acceptLanguage: header('accept-language'),
    cacheControl: header('cache-control'),
    pragma: header('pragma'),
    userAgent: header('user-agent'),
    contentType: header('content-type'),
    postData: serializeBody(req.body, config.redactBodyFields),
    getQuery: queryIdx >= 0 ? req.url.slice(queryIdx + 1) : ''
  };
};

const autoQualMiddleware = (options = {}) => {
  return (req, res, next) => {
    if (!AutoQualAgent._initialized) return next();

    const startTime = Date.now();
    const originalEnd = res.end.bind(res);

    res.end = function (...args) {
      const responseTime = Date.now() - startTime;
      const endpoint = req.route?.path || req.path || req.url?.split('?')[0];
      const method = req.method;
      const statusCode = res.statusCode;
      const config = AutoQualAgent._getConfig();
      const clientIp = config.captureClientIp !== false ? getClientIp(req) : undefined;

      AutoQualAgent._queueMetricFromMiddleware({
        endpoint,
        method,
        statusCode,
        clientIp,
        responseTime,
        requestCount: 1,
        errorCount: statusCode >= 400 ? 1 : 0
      });

      const threshold = options.slowThreshold || config.alertThresholds?.responseTime || 2000;
      const isSlow = responseTime > threshold;
      const isError = statusCode >= 500;
      const captureRaw = !!config.captureRawRequests
        && Math.random() < (config.captureRawRequestsSampleRate ?? 1);

      // One log entry per request at most — slow/error takes priority over the
      // plain capture-only entry so nothing gets logged twice for one request.
      let level = null;
      let message = null;
      if (isSlow) {
        level = 'warn';
        message = `Slow response on ${method} ${endpoint}: ${responseTime}ms`;
      } else if (isError) {
        level = 'error';
        message = `HTTP ${statusCode} on ${method} ${endpoint}`;
      } else if (captureRaw) {
        level = 'info';
        message = `${method} ${endpoint} ${statusCode}`;
      }

      if (level) {
        AutoQualAgent._queueLog(
          level,
          message,
          { responseTime, statusCode },
          endpoint,
          captureRaw ? buildRawRequest(req, config) : null
        );
      }

      return originalEnd(...args);
    };

    next();
  };
};

module.exports = { autoQualMiddleware };
