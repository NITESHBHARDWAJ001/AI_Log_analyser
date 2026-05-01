import { useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const scenarios = [
  { id: 'error_spike', label: 'Error Spike', description: 'Simulate 5 rapid error logs', icon: '💥', severity: 'critical' },
  { id: 'slow_api', label: 'Slow API', description: 'Simulate slow endpoint response (3200ms)', icon: '🐌', severity: 'high' },
  { id: 'memory', label: 'Memory Leak', description: 'Simulate high memory usage metric', icon: '📈', severity: 'high' },
  { id: 'normal', label: 'Normal Traffic', description: 'Simulate healthy request batch', icon: '✅', severity: 'low' },
  { id: 'mixed', label: 'Mixed Load', description: 'Mix of logs, metrics, and one error', icon: '⚗️', severity: 'medium' }
];

const buildPayload = (scenario, projectId) => {
  const ts = new Date().toISOString();
  const bases = {
    error_spike: {
      projectId,
      logs: Array.from({ length: 5 }, (_, i) => ({
        level: 'error',
        message: `Unhandled exception in requestHandler (${i + 1}/5): TypeError: Cannot read properties of undefined`,
        endpoint: '/api/payment',
        timestamp: ts
      })),
      metrics: [],
      endpoint: '/api/payment',
      timestamp: ts
    },
    slow_api: {
      projectId,
      logs: [{ level: 'warn', message: 'Response time exceeded threshold: 3200ms', endpoint: '/api/search', timestamp: ts }],
      metrics: [{ endpoint: '/api/search', method: 'GET', statusCode: 200, responseTime: 3200, timestamp: ts }],
      endpoint: '/api/search',
      timestamp: ts
    },
    memory: {
      projectId,
      logs: [{ level: 'warn', message: 'Memory usage at 94% — potential leak detected', timestamp: ts }],
      metrics: [{ memoryUsage: 94, cpuUsage: 67, requestCount: 1, timestamp: ts }],
      timestamp: ts
    },
    normal: {
      projectId,
      logs: Array.from({ length: 8 }, (_, i) => ({
        level: 'info',
        message: `GET /api/users/${i + 1} 200 ${30 + i * 5}ms`,
        endpoint: '/api/users',
        timestamp: ts
      })),
      metrics: Array.from({ length: 5 }, (_, i) => ({
        endpoint: '/api/users',
        method: 'GET',
        statusCode: 200,
        responseTime: 30 + i * 10,
        requestCount: 1,
        timestamp: ts
      })),
      timestamp: ts
    },
    mixed: {
      projectId,
      logs: [
        { level: 'info', message: 'POST /api/orders 201 145ms', endpoint: '/api/orders', timestamp: ts },
        { level: 'warn', message: 'Deprecated API version called: v1', endpoint: '/api/v1/users', timestamp: ts },
        { level: 'error', message: 'Database connection timeout after 5000ms', endpoint: '/api/data', timestamp: ts }
      ],
      metrics: [
        { endpoint: '/api/orders', method: 'POST', statusCode: 201, responseTime: 145, timestamp: ts },
        { endpoint: '/api/data', method: 'GET', statusCode: 500, responseTime: 5001, timestamp: ts }
      ],
      timestamp: ts
    }
  };
  return bases[scenario];
};

export default function SimulationPanel({ project }) {
  const [sending, setSending] = useState(null);

  const runScenario = async (scenario) => {
    if (!project) { toast.error('Select a project first'); return; }
    setSending(scenario.id);
    try {
      const payload = buildPayload(scenario.id, project.projectId);
      await api.post('/ingest', payload, {
        headers: { Authorization: `Bearer ${project.apiKey}` }
      });
      toast.success(`Simulated: ${scenario.label}`);
    } catch (err) {
      toast.error('Simulation failed — make sure the agent is authenticated');
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="card border-dashed border-surface-500">
      <div className="flex items-center gap-2 mb-4">
        <span>🧪</span>
        <h3 className="text-sm font-semibold text-white">Simulation Panel</h3>
        <span className="text-xs text-slate-500 ml-1">— test your dashboard in real-time</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {scenarios.map(s => (
          <button
            key={s.id}
            onClick={() => runScenario(s)}
            disabled={!!sending || !project}
            className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all
              ${sending === s.id
                ? 'bg-brand-600/20 border-brand-500/50 text-brand-300'
                : 'bg-surface-700 border-surface-500 text-slate-300 hover:bg-surface-600 hover:border-surface-400'
              } disabled:opacity-50`}
          >
            <span className="text-xl">{s.icon}</span>
            <span>{s.label}</span>
            <span className="text-slate-500 text-center leading-tight">{s.description}</span>
            {sending === s.id && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface-800/80 rounded-lg">
                <div className="w-4 h-4 border border-brand-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </button>
        ))}
      </div>

      {!project && (
        <p className="text-xs text-slate-500 mt-3 text-center">Select a project to enable simulations</p>
      )}
    </div>
  );
}
