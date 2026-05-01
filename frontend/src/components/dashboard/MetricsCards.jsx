const Card = ({ label, value, sub, color = 'text-white', icon }) => (
  <div className="bg-surface-700 rounded-lg p-3 border border-surface-600">
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-base">{icon}</span>
    </div>
    <div className={`text-xl font-bold ${color}`}>{value ?? '—'}</div>
    {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
  </div>
);

export default function MetricsCards({ overview }) {
  const errorRate = overview?.errorRate ?? 0;
  const avgRt = overview?.avgResponseTime ?? 0;

  return (
    <div className="grid grid-cols-2 gap-2">
      <Card
        label="Total Requests"
        value={overview?.totalRequests?.toLocaleString() ?? '0'}
        sub="Last 24h"
        color="text-blue-400"
        icon="📡"
      />
      <Card
        label="Error Rate"
        value={`${errorRate}%`}
        sub={errorRate > 5 ? '⚠ High' : errorRate > 1 ? 'Elevated' : '✓ Normal'}
        color={errorRate > 5 ? 'text-red-400' : errorRate > 1 ? 'text-yellow-400' : 'text-green-400'}
        icon="💢"
      />
      <Card
        label="Avg Response"
        value={`${avgRt}ms`}
        sub={avgRt > 1000 ? '⚠ Slow' : avgRt > 500 ? 'Moderate' : '✓ Fast'}
        color={avgRt > 1000 ? 'text-red-400' : avgRt > 500 ? 'text-yellow-400' : 'text-green-400'}
        icon="⚡"
      />
      <Card
        label="Active Issues"
        value={overview?.activeIssues ?? '0'}
        sub="Unresolved"
        color={(overview?.activeIssues ?? 0) > 0 ? 'text-orange-400' : 'text-green-400'}
        icon="🔍"
      />
    </div>
  );
}
