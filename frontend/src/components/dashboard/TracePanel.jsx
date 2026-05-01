export default function TracePanel({ issues, project }) {
  const traced = issues
    .filter(i => i.traceFile || i.endpoint)
    .slice(0, 8);

  const serviceMap = project?.serviceMap || [];

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-white mb-3">Trace Engine</h3>
      {serviceMap.length > 0 && (
        <div className="mb-3 pb-3 border-b border-surface-600">
          <p className="text-xs text-slate-400 mb-2">Service Map</p>
          {serviceMap.slice(0, 4).map((sm, i) => (
            <div key={i} className="text-xs font-mono text-slate-400 flex items-center gap-1 mb-1">
              <span className="text-brand-400 truncate">{sm.endpoint}</span>
              <span className="text-slate-600">→</span>
              <span className="text-green-400 truncate">{sm.file}{sm.line ? `:${sm.line}` : ''}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {traced.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-3">No traces yet</p>
        ) : (
          traced.map(issue => (
            <div key={issue._id} className="bg-surface-700 rounded-lg p-2">
              <div className="flex items-center gap-1 text-xs font-mono mb-1">
                {issue.endpoint && (
                  <span className="text-brand-400 truncate">{issue.endpoint}</span>
                )}
                {issue.traceFile && (
                  <>
                    <span className="text-slate-600">→</span>
                    <span className="text-green-400 truncate">
                      {issue.traceFile}{issue.traceLine ? `:${issue.traceLine}` : ''}
                    </span>
                  </>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate">{issue.title}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
