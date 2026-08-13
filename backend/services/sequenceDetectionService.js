// Sequence/behavior-aware detection — unlike patternDetectionService (judges one
// request in isolation) and mlService (judges one request's content), this tracks
// what a single client IP does across a *sliding time window*, which is what
// actually distinguishes DDoS floods, endpoint scanning, and brute force from
// normal traffic: none of those show up in a single request, only in the pattern
// of many.
//
// In-memory, per-process — consistent with this app's existing single-instance
// assumption (see the report-scheduler note in README.md). Entries are pruned
// lazily on access, so memory stays bounded to recent activity, not total uptime.

const WINDOW_MS = 60 * 1000; // 1-minute sliding window
const DDOS_REQUEST_THRESHOLD = 100;     // requests from one IP within the window
const SCAN_ENDPOINT_THRESHOLD = 15;     // distinct endpoints from one IP within the window
const BRUTE_FORCE_FAILURE_THRESHOLD = 5; // failed auth responses within the window

const AUTH_ENDPOINT_RE = /login|signin|sign-in|auth|token|password/i;

// projectId -> clientIp -> [{ ts, endpoint, statusCode }]
const activity = new Map();

const getEvents = (projectId, clientIp) => {
  if (!activity.has(projectId)) activity.set(projectId, new Map());
  const projectMap = activity.get(projectId);
  if (!projectMap.has(clientIp)) projectMap.set(clientIp, []);
  return projectMap.get(clientIp);
};

const prune = (events, now) => {
  while (events.length && now - events[0].ts > WINDOW_MS) events.shift();
};

// Records one request's outcome and returns any findings it triggers this call.
// Call once per ingested metric that has a clientIp — see watcherService.js.
const recordAndCheck = ({ projectId, clientIp, endpoint, statusCode }) => {
  if (!clientIp) return [];

  const now = Date.now();
  const events = getEvents(projectId, clientIp);
  events.push({ ts: now, endpoint, statusCode });
  prune(events, now);

  const findings = [];

  // --- DDoS / volumetric flood: too many requests from one IP in the window
  if (events.length === DDOS_REQUEST_THRESHOLD) {
    findings.push({
      type: 'ddos',
      severity: 'critical',
      title: `Possible DDoS / request flood from ${clientIp}`,
      description: `${events.length} requests from a single IP in ${WINDOW_MS / 1000}s. How to fix: rate-limit or temporarily block ${clientIp} at the load balancer/WAF/CDN layer, and add IP-based rate limiting (e.g. express-rate-limit) in front of this app if it isn't already there.`,
      endpoint
    });
  }

  // --- Scanning / reconnaissance: many distinct endpoints from one IP
  const distinctEndpoints = new Set(events.map(e => e.endpoint).filter(Boolean));
  if (distinctEndpoints.size === SCAN_ENDPOINT_THRESHOLD) {
    findings.push({
      type: 'scanning',
      severity: 'high',
      title: `Endpoint scanning detected from ${clientIp}`,
      description: `${distinctEndpoints.size} distinct endpoints hit by one IP in ${WINDOW_MS / 1000}s — typical of automated reconnaissance/vulnerability scanning. How to fix: rate-limit or block ${clientIp}, and review what it accessed.`,
      endpoint
    });
  }

  // --- Brute force / credential stuffing (only meaningful on auth-like endpoints)
  if (endpoint && AUTH_ENDPOINT_RE.test(endpoint)) {
    const authEvents = events.filter(e => e.endpoint && AUTH_ENDPOINT_RE.test(e.endpoint));
    const failures = authEvents.filter(e => e.statusCode === 401 || e.statusCode === 403);

    if (failures.length >= BRUTE_FORCE_FAILURE_THRESHOLD) {
      const justSucceeded = statusCode >= 200 && statusCode < 300;
      if (justSucceeded) {
        findings.push({
          type: 'credential_stuffing',
          severity: 'critical',
          title: `Possible credential stuffing success from ${clientIp}`,
          description: `Login succeeded after ${failures.length} failed attempts from the same IP in ${WINDOW_MS / 1000}s. How to fix: this account may be compromised — force a password reset, review its recent activity, and add account lockout after repeated failures.`,
          endpoint
        });
      } else if (failures.length === BRUTE_FORCE_FAILURE_THRESHOLD) {
        findings.push({
          type: 'bruteforce',
          severity: 'high',
          title: `Brute force attempt from ${clientIp}`,
          description: `${failures.length} failed login attempts from the same IP in ${WINDOW_MS / 1000}s. How to fix: add account lockout / exponential backoff after repeated failures, enable CAPTCHA after N attempts, and rate-limit or block ${clientIp}.`,
          endpoint
        });
      }
    }
  }

  return findings;
};

const clearAll = () => activity.clear(); // test-only

module.exports = { recordAndCheck, clearAll, WINDOW_MS, DDOS_REQUEST_THRESHOLD, SCAN_ENDPOINT_THRESHOLD, BRUTE_FORCE_FAILURE_THRESHOLD };
