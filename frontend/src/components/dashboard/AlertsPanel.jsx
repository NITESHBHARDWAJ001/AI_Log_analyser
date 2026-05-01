const severityStyles = {
  critical: 'border-red-500/40 bg-red-500/5',
  warning: 'border-yellow-500/40 bg-yellow-500/5',
  info: 'border-blue-500/40 bg-blue-500/5'
};

const severityDot = {
  critical: 'bg-red-400 animate-pulse',
  warning: 'bg-yellow-400',
  info: 'bg-blue-400'
};

export default function AlertsPanel({ alerts, onMarkRead }) {
  const unread = alerts.filter(a => !a.read);
  const display = alerts.slice(0, 15);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Alerts</h3>
          {unread.length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-56 overflow-y-auto">
        {display.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No alerts — system healthy</p>
        ) : (
          display.map(alert => (
            <div
              key={alert._id}
              className={`flex items-start gap-2 p-2 rounded-lg border text-xs transition-opacity ${severityStyles[alert.severity] || severityStyles.info} ${alert.read ? 'opacity-50' : ''}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${severityDot[alert.severity] || 'bg-slate-400'}`} />
              <div className="flex-1 min-w-0">
                <p className={`font-medium truncate ${alert.severity === 'critical' ? 'text-red-300' : alert.severity === 'warning' ? 'text-yellow-300' : 'text-blue-300'}`}>
                  {alert.message}
                </p>
                <p className="text-slate-500 mt-0.5">{new Date(alert.timestamp).toLocaleTimeString()}</p>
              </div>
              {!alert.read && (
                <button onClick={() => onMarkRead(alert._id)} className="text-slate-500 hover:text-slate-300 flex-shrink-0">✕</button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
