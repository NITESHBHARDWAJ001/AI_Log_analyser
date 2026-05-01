import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useMemo } from 'react';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-700 border border-surface-500 rounded-lg p-2 text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function Charts({ chartData }) {
  const responseData = useMemo(() => {
    if (!chartData?.responseTimeByHour) return [];
    return chartData.responseTimeByHour.map(d => ({
      time: new Date(d._id).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }),
      responseTime: Math.round(d.avgResponseTime),
      requests: d.count
    }));
  }, [chartData]);

  const logData = useMemo(() => {
    if (!chartData?.logsByHour) return [];
    const byHour = {};
    chartData.logsByHour.forEach(d => {
      const time = new Date(d._id.hour).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
      if (!byHour[time]) byHour[time] = { time, info: 0, warn: 0, error: 0 };
      byHour[time][d._id.level] = d.count;
    });
    return Object.values(byHour);
  }, [chartData]);

  if (!chartData) {
    return (
      <div className="card h-48 flex items-center justify-center text-slate-500 text-sm">
        No chart data yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Response Time Chart */}
      <div className="card">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Response Time (ms)</h3>
        {responseData.length > 0 ? (
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={responseData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d45" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="responseTime" stroke="#6366f1" strokeWidth={2} dot={false} name="Avg ms" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-24 flex items-center justify-center text-slate-500 text-xs">Waiting for data...</div>
        )}
      </div>

      {/* Log Volume Chart */}
      <div className="card">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Log Volume</h3>
        {logData.length > 0 ? (
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={logData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d45" />
              <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 9 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="info" stackId="a" fill="#6366f1" name="Info" />
              <Bar dataKey="warn" stackId="a" fill="#eab308" name="Warn" />
              <Bar dataKey="error" stackId="a" fill="#ef4444" name="Error" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-24 flex items-center justify-center text-slate-500 text-xs">Waiting for data...</div>
        )}
      </div>
    </div>
  );
}
