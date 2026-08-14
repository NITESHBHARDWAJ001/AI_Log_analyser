// Talks to the ml-service/ FastAPI service for ML-based request classification.
// Falls back to Groq (via aiService) when the ML service is down, erroring, or
// hasn't loaded a model — so detection degrades gracefully instead of going dark.

const { classifyRequestWithGroq, classifySecurityEventWithGroq } = require('./aiService');

const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://localhost:8001').replace(/\/$/, '');
const ML_SERVICE_API_KEY = process.env.ML_SERVICE_API_KEY || '';
const ML_SERVICE_TIMEOUT_MS = Number(process.env.ML_SERVICE_TIMEOUT_MS) || 5000;
const ANOMALY_CONFIDENCE_THRESHOLD = Number(process.env.ANOMALY_CONFIDENCE_THRESHOLD) || 0.85;

const toMlPayload = (requestFields) => ({
  method: requestFields.method || 'GET',
  host_header: requestFields.hostHeader || '',
  connection: requestFields.connection || '',
  accept: requestFields.accept || '',
  accept_charset: requestFields.acceptCharset || '',
  accept_language: requestFields.acceptLanguage || '',
  cache_control: requestFields.cacheControl || '',
  pragma: requestFields.pragma || '',
  user_agent: requestFields.userAgent || '',
  content_type: requestFields.contentType || '',
  post_data: requestFields.postData || '',
  get_query: requestFields.getQuery || ''
});

const classifyWithGroqFallback = async (requestFields) => {
  try {
    const result = await classifyRequestWithGroq(requestFields);
    return {
      source: 'groq-fallback',
      isAnomalous: result.isAnomalous,
      confident: result.isAnomalous && result.confidence >= ANOMALY_CONFIDENCE_THRESHOLD,
      confidence: result.confidence,
      label: result.isAnomalous ? 'Anomalous' : 'Valid',
      reasoning: result.reasoning
    };
  } catch (err) {
    console.error('Groq fallback classification failed:', err.message);
    return { source: 'unavailable', isAnomalous: false, confident: false, confidence: 0, label: 'Unknown' };
  }
};

// requestFields: { method, hostHeader, connection, accept, acceptCharset, acceptLanguage,
//                  cacheControl, pragma, userAgent, contentType, postData, getQuery }
const classifyWebRequest = async (requestFields) => {
  let timeoutId;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), ML_SERVICE_TIMEOUT_MS);

    const res = await fetch(`${ML_SERVICE_URL}/predict/web-attack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ML_SERVICE_API_KEY && { 'X-API-Key': ML_SERVICE_API_KEY })
      },
      body: JSON.stringify(toMlPayload(requestFields)),
      signal: controller.signal
    });

    if (!res.ok) throw new Error(`ML service returned ${res.status}`);
    const result = await res.json();

    return {
      source: 'ml-model',
      isAnomalous: result.is_anomalous,
      confident: result.confident,
      confidence: result.anomalous_probability,
      label: result.label
    };
  } catch (err) {
    console.error('ML service unavailable, falling back to Groq:', err.message);
    return classifyWithGroqFallback(requestFields);
  } finally {
    clearTimeout(timeoutId);
  }
};

const toSecurityEventPayload = (logFields) => ({
  message: logFields.message || '',
  log_type: logFields.logType || 'agent',
  client_ip: logFields.clientIp || ''
});

const classifySecurityEventWithGroqFallback = async (logFields) => {
  try {
    const result = await classifySecurityEventWithGroq(logFields);
    return {
      source: 'groq-fallback',
      label: result.label,
      isBenign: result.label === 'benign',
      confident: result.label !== 'benign' && result.confidence >= ANOMALY_CONFIDENCE_THRESHOLD,
      confidence: result.confidence,
      reasoning: result.reasoning
    };
  } catch (err) {
    console.error('Groq security-event fallback failed:', err.message);
    return { source: 'unavailable', label: 'unknown', isBenign: true, confident: false, confidence: 0 };
  }
};

// logFields: { message, logType, clientIp } — classifies one log line into one of the
// security-event model's categories (benign, bruteforce_*, dir_scan, file_inclusion, ...).
const classifySecurityEvent = async (logFields) => {
  let timeoutId;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), ML_SERVICE_TIMEOUT_MS);

    const res = await fetch(`${ML_SERVICE_URL}/predict/security-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ML_SERVICE_API_KEY && { 'X-API-Key': ML_SERVICE_API_KEY })
      },
      body: JSON.stringify(toSecurityEventPayload(logFields)),
      signal: controller.signal
    });

    if (!res.ok) throw new Error(`ML service returned ${res.status}`);
    const result = await res.json();

    return {
      source: 'ml-model',
      label: result.label,
      isBenign: result.is_benign,
      confident: result.confident,
      confidence: result.confidence
    };
  } catch (err) {
    console.error('ML service unavailable for security-event, falling back to Groq:', err.message);
    return classifySecurityEventWithGroqFallback(logFields);
  } finally {
    clearTimeout(timeoutId);
  }
};

module.exports = { classifyWebRequest, classifySecurityEvent };
