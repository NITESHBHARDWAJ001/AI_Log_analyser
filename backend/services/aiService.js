// AI analysis via Groq (server-side) — replaces the old client-side Puter.js flow.

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const buildIssuePrompt = (issue, recentLogs) => {
  const logSample = recentLogs.slice(0, 10).map(l =>
    `[${l.level.toUpperCase()}] ${l.message}${l.endpoint ? ` (${l.endpoint})` : ''}`
  ).join('\n');

  return `You are an expert software engineer analyzing a production issue.

ISSUE: ${issue.title}
TYPE: ${issue.type}
SEVERITY: ${issue.severity}
ENDPOINT: ${issue.endpoint || 'N/A'}
FILE TRACE: ${issue.traceFile || 'N/A'}${issue.traceLine ? `:${issue.traceLine}` : ''}

RECENT LOGS:
${logSample}

Provide a JSON response with:
{
  "rootCause": "Concise explanation of the root cause",
  "suggestion": "Step-by-step fix recommendation",
  "codeSnippet": "Relevant code fix or diagnostic code (if applicable)",
  "summary": "One-sentence summary for the dashboard"
}`;
};

const buildDailyReportPrompt = (stats, topIssues) => {
  const issueList = topIssues.map((i, idx) =>
    `${idx + 1}. ${i.title} (${i.severity}, seen ${i.count} times)`
  ).join('\n');

  return `You are an AI engineer summarizing a daily system health report.

STATS (last 24h):
- Total logs: ${stats.totalLogs}
- Error logs: ${stats.errorLogs}
- Warn logs: ${stats.warnLogs}
- Total requests: ${stats.totalRequests}
- Avg response time: ${stats.avgResponseTime}ms
- Error rate: ${stats.errorRate}%
- Active issues: ${stats.issueCount}
- Health score: ${stats.healthScore}/100

TOP ISSUES:
${issueList || 'No issues detected'}

Write a concise, actionable daily report summary (3-5 sentences) for the engineering team. Be specific about what needs attention.`;
};

const buildLiveSummaryPrompt = (overview, topIssues = []) => {
  const issueList = topIssues.map((i, idx) =>
    `${idx + 1}. ${i.title} (${i.severity})`
  ).join('\n');

  return `You are an AI engineer summarizing a system health report for an engineering team.

CURRENT STATS:
- Health Score: ${overview?.healthScore ?? 'N/A'}/100
- Total Requests: ${overview?.totalRequests ?? 0}
- Error Rate: ${overview?.errorRate ?? 0}%
- Avg Response Time: ${overview?.avgResponseTime ?? 0}ms
- Active Issues: ${overview?.activeIssues ?? 0}
- Error Logs: ${overview?.errorLogs ?? 0}

TOP ISSUES:
${issueList || 'None'}

Write a concise 2-3 sentence AI summary of the system health. Be specific and actionable. Focus on what engineering should prioritize.`;
};

const buildRequestClassificationPrompt = (requestFields) => {
  return `You are a security analyst. This is a fallback check because the ML classifier is unavailable — assess whether this HTTP request looks malicious (SQL injection, XSS, path traversal, command injection, or other attack) or looks like normal legitimate traffic.

METHOD: ${requestFields.method || 'N/A'}
HOST HEADER: ${requestFields.hostHeader || 'N/A'}
USER AGENT: ${requestFields.userAgent || 'N/A'}
GET QUERY: ${requestFields.getQuery || 'N/A'}
POST DATA: ${requestFields.postData || 'N/A'}
CONTENT TYPE: ${requestFields.contentType || 'N/A'}

Respond with JSON only:
{
  "isAnomalous": true or false,
  "confidence": a number between 0 and 1,
  "reasoning": "one sentence explaining why"
}`;
};

const getGroqKeys = () => {
  const fallback = (process.env.GROQ_FALLBACK_KEYS || '').split(',');
  return [process.env.GROQ_API_KEY, ...fallback].map(k => k?.trim()).filter(Boolean);
};

// Tries each configured key in order, falling back on auth/rate-limit/server errors.
const callGroq = async (prompt) => {
  const keys = getGroqKeys();
  if (keys.length === 0) throw new Error('No GROQ_API_KEY configured');

  let lastErr;
  for (const key of keys) {
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3
        })
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Groq API ${res.status}: ${body.slice(0, 300)}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      lastErr = err;
      console.error('Groq key failed, trying next key:', err.message);
    }
  }
  throw lastErr || new Error('All Groq keys failed');
};

// Escapes raw control characters (newlines, tabs) that land inside quoted
// strings — Groq often emits multi-line code snippets as literal newlines
// instead of escaped \n, which otherwise breaks JSON.parse.
const escapeControlCharsInStrings = (raw) => {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of raw) {
    if (escaped) { out += ch; escaped = false; continue; }
    if (ch === '\\') { out += ch; escaped = true; continue; }
    if (ch === '"') { inString = !inString; out += ch; continue; }
    if (inString && ch === '\n') { out += '\\n'; continue; }
    if (inString && ch === '\r') { out += '\\r'; continue; }
    if (inString && ch === '\t') { out += '\\t'; continue; }
    out += ch;
  }
  return out;
};

const parseJsonResponse = (text) => {
  // Strip markdown code fences (```json ... ```) some models wrap responses in
  const stripped = text.replace(/```(?:json)?/gi, '');
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return { summary: text.trim() };

  try {
    return JSON.parse(match[0]);
  } catch {
    try {
      return JSON.parse(escapeControlCharsInStrings(match[0]));
    } catch {
      return { summary: text.trim() };
    }
  }
};

// Groq doesn't always honor "return a string" — sometimes a field comes back
// as an array of steps or a nested object. Flatten to plain text so it always
// satisfies the Issue schema (aiAnalysis fields are all Strings).
const toText = (value) => {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((v, i) => (typeof v === 'string' ? `${i + 1}. ${v.replace(/^\d+[.)]\s*/, '')}` : JSON.stringify(v)))
      .join('\n');
  }
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

const analyzeIssueWithAI = async (issue, recentLogs) => {
  const text = await callGroq(buildIssuePrompt(issue, recentLogs));
  const parsed = parseJsonResponse(text);
  return {
    rootCause: toText(parsed.rootCause),
    suggestion: toText(parsed.suggestion),
    codeSnippet: toText(parsed.codeSnippet),
    summary: toText(parsed.summary) || text
  };
};

const generateDailyReportSummary = async (stats, topIssues) => {
  return callGroq(buildDailyReportPrompt(stats, topIssues));
};

const generateLiveSummary = async (overview, topIssues) => {
  return callGroq(buildLiveSummaryPrompt(overview, topIssues));
};

// Fallback request classifier used when the ML service (ml-service/) is unreachable —
// asks Groq the same "is this malicious" question the ML model would otherwise answer.
const classifyRequestWithGroq = async (requestFields) => {
  const text = await callGroq(buildRequestClassificationPrompt(requestFields));
  const parsed = parseJsonResponse(text);
  const confidence = typeof parsed.confidence === 'number'
    ? Math.max(0, Math.min(1, parsed.confidence))
    : 0.5;
  return {
    isAnomalous: !!parsed.isAnomalous,
    confidence,
    reasoning: toText(parsed.reasoning) || text
  };
};

module.exports = {
  buildIssuePrompt,
  buildDailyReportPrompt,
  buildLiveSummaryPrompt,
  analyzeIssueWithAI,
  generateDailyReportSummary,
  generateLiveSummary,
  classifyRequestWithGroq
};
