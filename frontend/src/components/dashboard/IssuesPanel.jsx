const severityBadge = (s) => {
  const map = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };
  return map[s] || 'badge-info';
};

export default function IssuesPanel({ issues, onResolve }) {
  const active = issues.filter(i => !i.resolved);
  const resolved = issues.filter(i => i.resolved).slice(0, 3);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Issues</h3>
        <span className="text-xs text-slate-500">{active.length} active</span>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {active.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-2xl mb-1">✅</div>
            <p className="text-xs text-slate-400">No active issues</p>
          </div>
        ) : (
          active.slice(0, 15).map(issue => (
            <div key={issue._id} className="flex items-start gap-3 bg-surface-700 rounded-lg p-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={severityBadge(issue.severity)}>{issue.severity}</span>
                  <span className="text-xs text-slate-400 capitalize">{issue.type.replace(/_/g, ' ')}</span>
                </div>
                <p className="text-xs text-white truncate">{issue.title}</p>
                {issue.endpoint && (
                  <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">{issue.endpoint}</p>
                )}
                {issue.aiAnalysis?.summary && (
                  <p className="text-xs text-brand-400 mt-1 truncate">🤖 {issue.aiAnalysis.summary}</p>
                )}
                <p className="text-xs text-slate-600 mt-0.5">
                  {issue.count > 1 ? `${issue.count}× · ` : ''}Last: {new Date(issue.lastSeen).toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => onResolve(issue._id)}
                className="flex-shrink-0 text-xs text-slate-400 hover:text-green-400 transition-colors border border-surface-500 hover:border-green-500/50 rounded px-2 py-1"
              >
                Resolve
              </button>
            </div>
          ))
        )}

        {resolved.length > 0 && (
          <div className="mt-3 pt-3 border-t border-surface-600">
            <p className="text-xs text-slate-500 mb-2">Recently Resolved</p>
            {resolved.map(issue => (
              <div key={issue._id} className="flex items-center gap-2 text-xs text-slate-500 py-0.5 opacity-50">
                <span className="text-green-500">✓</span>
                <span className="truncate">{issue.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
