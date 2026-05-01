import { useState } from 'react';

export default function AISummary({ project, overview, aiSummary, onGenerateSummary }) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try { await onGenerateSummary(); } finally { setGenerating(false); }
  };

  return (
    <div className="card border-brand-500/20 min-h-[140px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="text-sm font-semibold text-white">AI Summary</h3>
          <span className="text-xs text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">Grok</span>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !project}
          className="text-xs btn-secondary py-1 px-3 disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 border border-brand-400 border-t-transparent rounded-full animate-spin" />
              Analyzing...
            </span>
          ) : 'Generate'}
        </button>
      </div>

      <div className="flex-1 flex items-center">
        {aiSummary ? (
          <p className="text-sm text-slate-300 leading-relaxed animate-fade-in">{aiSummary}</p>
        ) : (
          <div className="text-sm text-slate-500 italic">
            {project
              ? 'Click Generate to get an AI-powered health summary using Grok.'
              : 'Select a project to enable AI insights.'}
          </div>
        )}
      </div>

      {overview && (
        <div className="mt-3 pt-3 border-t border-surface-600 grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Total Logs', value: overview.totalLogs?.toLocaleString() ?? 0 },
            { label: 'Errors', value: overview.errorLogs ?? 0, red: (overview.errorLogs ?? 0) > 0 },
            { label: 'Warnings', value: overview.warnLogs ?? 0, yellow: (overview.warnLogs ?? 0) > 0 },
            { label: 'Last Seen', value: overview.lastSeen ? new Date(overview.lastSeen).toLocaleTimeString() : 'Never' }
          ].map(m => (
            <div key={m.label}>
              <div className={`text-sm font-semibold ${m.red ? 'text-red-400' : m.yellow ? 'text-yellow-400' : 'text-white'}`}>{m.value}</div>
              <div className="text-xs text-slate-500">{m.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
