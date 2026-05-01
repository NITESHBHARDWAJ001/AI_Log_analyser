const statusColors = {
  active: 'text-green-400 bg-green-400/10 border-green-400/30',
  warning: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  critical: 'text-red-400 bg-red-400/10 border-red-400/30',
  inactive: 'text-slate-400 bg-slate-400/10 border-slate-400/30'
};

export default function Header({ project, overview }) {
  const status = overview?.status || project?.status || 'active';

  return (
    <header className="bg-surface-800 border-b border-surface-600 px-5 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-white font-semibold text-base leading-tight">
            {project?.name || 'Dashboard'}
          </h1>
          {project?.baseUrl && (
            <p className="text-slate-500 text-xs">{project.baseUrl}</p>
          )}
        </div>
        {project && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${statusColors[status]}`}>
            {status}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {overview && (
          <>
            <div className="text-center hidden sm:block">
              <div className="text-xs text-slate-500">Requests</div>
              <div className="text-sm font-semibold text-white">{overview.totalRequests?.toLocaleString() ?? 0}</div>
            </div>
            <div className="text-center hidden sm:block">
              <div className="text-xs text-slate-500">Error Rate</div>
              <div className={`text-sm font-semibold ${overview.errorRate > 5 ? 'text-red-400' : overview.errorRate > 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                {overview.errorRate ?? 0}%
              </div>
            </div>
            <div className="text-center hidden md:block">
              <div className="text-xs text-slate-500">Avg Response</div>
              <div className={`text-sm font-semibold ${overview.avgResponseTime > 1000 ? 'text-red-400' : overview.avgResponseTime > 500 ? 'text-yellow-400' : 'text-green-400'}`}>
                {overview.avgResponseTime ?? 0}ms
              </div>
            </div>
          </>
        )}

        <div className="flex items-center gap-1.5 text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live
        </div>
      </div>
    </header>
  );
}
