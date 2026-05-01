import { useState } from 'react';

const InsightCard = ({ insight }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface-700 border border-brand-500/20 rounded-lg p-3 animate-slide-up">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-brand-400 text-sm">🤖</span>
          <span className="text-xs font-medium text-brand-300">AI Analysis</span>
        </div>
        <span className="text-xs text-slate-500">{new Date(insight.timestamp).toLocaleTimeString()}</span>
      </div>

      {insight.summary && (
        <p className="text-xs text-slate-300 mb-2">{insight.summary}</p>
      )}

      {insight.rootCause && (
        <div className="mb-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Root Cause</p>
          <p className="text-xs text-slate-300">{insight.rootCause}</p>
        </div>
      )}

      {insight.suggestion && (
        <div className="mb-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Fix</p>
          <p className="text-xs text-slate-300">{insight.suggestion}</p>
        </div>
      )}

      {insight.codeSnippet && (
        <div>
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-brand-400 hover:text-brand-300 mb-1">
            {expanded ? '▲ Hide code' : '▼ Show code snippet'}
          </button>
          {expanded && (
            <pre className="text-xs text-green-400 bg-surface-800 rounded p-2 overflow-x-auto font-mono">
              {insight.codeSnippet}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default function AISuggestions({ insights }) {
  return (
    <div className="card flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span>🧠</span>
        <h3 className="text-sm font-semibold text-white">AI Suggestions</h3>
        <span className="text-xs text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">Grok</span>
        {insights.length > 0 && (
          <span className="ml-auto text-xs text-slate-500">{insights.length} insight{insights.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto flex-1">
        {insights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-4xl mb-2">🔮</div>
            <p className="text-sm text-slate-400">AI insights appear here when issues are detected.</p>
            <p className="text-xs text-slate-500 mt-1">Powered by Grok via Puter.js</p>
          </div>
        ) : (
          insights.map((insight, i) => <InsightCard key={i} insight={insight} />)
        )}
      </div>
    </div>
  );
}
