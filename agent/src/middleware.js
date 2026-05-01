const { AutoQualAgent } = require('./agent');

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

      AutoQualAgent._queueMetricFromMiddleware({
        endpoint,
        method,
        statusCode,
        responseTime,
        requestCount: 1,
        errorCount: statusCode >= 400 ? 1 : 0
      });

      // Log slow requests
      const threshold = options.slowThreshold || AutoQualAgent._getConfig().alertThresholds?.responseTime || 2000;
      if (responseTime > threshold) {
        AutoQualAgent._queueLog(
          'warn',
          `Slow response on ${method} ${endpoint}: ${responseTime}ms`,
          { responseTime, statusCode },
          endpoint
        );
      }

      // Log 5xx errors
      if (statusCode >= 500) {
        AutoQualAgent._queueLog(
          'error',
          `HTTP ${statusCode} on ${method} ${endpoint}`,
          { statusCode, responseTime },
          endpoint
        );
      }

      return originalEnd(...args);
    };

    next();
  };
};

module.exports = { autoQualMiddleware };
