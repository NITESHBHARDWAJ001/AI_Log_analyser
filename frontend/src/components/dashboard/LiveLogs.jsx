import { useEffect, useRef, useState } from 'react';

const levelColors = {
  info: 'text-slate-300',
  debug: 'text-slate-500',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  fatal: 'text-red-500 font-bold'
};

const levelBg = {
  error: 'bg-red-500/5',
  fatal: 'bg-red-500/10',
  warn: 'bg-yellow-500/5',
  info: '',
  debug: ''
};

const LogRow = ({ log }) => {
  const time = new Date(log.timestamp).toLocaleTimeString('en', { hour12: false });
  return (
    <div className={`flex gap-2 py-0.5 px-1 rounded text-xs font-mono animate-fade-in ${levelBg[log.level] || ''}`}>
      <span className="text-slate-600 flex-shrink-0 w-16">{time}</span>
      <span className={`flex-shrink-0 w-12 uppercase font-medium ${levelColors[log.level] || 'text-slate-300'}`}>
        [{log.level}]
      </span>
      <span className={`flex-1 min-w-0 truncate ${levelColors[log.level] || 'text-slate-300'}`}>
        {log.message}
      </span>
    </div>
  );
};

export default function LiveLogs({ logs }) {
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setAutoScroll(atBottom);
  };

  const filtered = logs.filter(l => {
    if (filter !== 'all' && l.level !== filter) return false;
    if (search && !l.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="card flex flex-col h-96 xl:h-full xl:min-h-[420px]">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <h3 className="text-sm font-semibold text-white">Live Logs</h3>
          <span className="text-xs text-slate-500">{filtered.length}</span>
        </div>
        {!autoScroll && (
          <button onClick={() => { setAutoScroll(true); bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
            className="text-xs text-brand-400 hover:text-brand-300">
            ↓ Latest
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-2 flex-shrink-0">
        <input
          className="input text-xs py-1 flex-1"
          placeholder="Search logs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input text-xs py-1 w-24" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="error">Error</option>
          <option value="warn">Warn</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
          <option value="fatal">Fatal</option>
        </select>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto space-y-0.5 min-h-0"
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Waiting for logs...
          </div>
        ) : (
          filtered.map((log, i) => <LogRow key={log._id || i} log={log} />)
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
