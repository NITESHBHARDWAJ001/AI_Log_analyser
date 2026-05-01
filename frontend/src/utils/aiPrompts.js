export const buildDailyReportPrompt = (overview, topIssues = []) => {
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
