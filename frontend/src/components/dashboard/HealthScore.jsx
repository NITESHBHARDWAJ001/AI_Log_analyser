export default function HealthScore({ overview }) {
  const score = overview?.healthScore ?? 100;
  const status = overview?.status || 'active';

  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
  const textColor = score >= 80 ? 'text-green-400' : score >= 50 ? 'text-yellow-400' : 'text-red-400';
  const ringBg = score >= 80 ? 'border-green-500/30' : score >= 50 ? 'border-yellow-500/30' : 'border-red-500/30';

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="card flex flex-col items-center justify-center min-h-[140px]">
      <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">Health Score</p>

      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#1a1a27" strokeWidth="10" />
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-3xl font-bold ${textColor}`}>{score}</span>
          <span className="text-xs text-slate-500">/100</span>
        </div>
      </div>

      <span className={`mt-3 text-xs px-2 py-0.5 rounded-full capitalize font-medium ${textColor} bg-opacity-10`}>
        {status}
      </span>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-center">
        <div>
          <div className="text-xs text-slate-500">Issues</div>
          <div className="text-sm font-semibold text-white">{overview?.activeIssues ?? 0}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">Alerts</div>
          <div className="text-sm font-semibold text-white">{overview?.unreadAlerts ?? 0}</div>
        </div>
      </div>
    </div>
  );
}
