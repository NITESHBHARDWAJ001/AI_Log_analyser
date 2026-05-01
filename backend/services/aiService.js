// AI analysis via Puter.js Grok — called server-side by emitting events to frontend
// The frontend handles actual puter.ai.chat calls since Puter.js is browser-based
// Backend provides the prompt structure; UI executes and returns results via socket

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

module.exports = { buildIssuePrompt, buildDailyReportPrompt };
