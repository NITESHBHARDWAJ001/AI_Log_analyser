import { Link } from 'react-router-dom';

const statusDot = (status) => {
  const colors = { active: 'bg-green-400', warning: 'bg-yellow-400', critical: 'bg-red-400 animate-pulse', inactive: 'bg-slate-500' };
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[status] || 'bg-slate-500'}`} />;
};

export default function Sidebar({ projects, activeProject, onSelectProject, user, onLogout, onNewProject }) {
  return (
    <aside className="w-60 flex-shrink-0 bg-surface-800 border-r border-surface-600 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-surface-600">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">AQ</div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">AutoQual</div>
            <div className="text-brand-400 text-xs">AI+</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="p-3 border-b border-surface-600">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide px-2 mb-2">Navigation</p>
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-300 hover:bg-surface-700 hover:text-white transition-colors text-sm">
          <span>📊</span> Dashboard
        </Link>
        <Link to="/docs" className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-slate-300 hover:bg-surface-700 hover:text-white transition-colors text-sm">
          <span>📖</span> Docs
        </Link>
      </div>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Projects</p>
          <button onClick={onNewProject} className="text-brand-400 hover:text-brand-300 text-xs transition-colors" title="New project">+</button>
        </div>
        {projects.map(p => (
          <button
            key={p._id}
            onClick={() => onSelectProject(p)}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors text-left ${
              activeProject?._id === p._id
                ? 'bg-brand-600/20 border border-brand-500/30 text-white'
                : 'text-slate-400 hover:bg-surface-700 hover:text-white'
            }`}
          >
            {statusDot(p.status)}
            <span className="truncate flex-1">{p.name}</span>
            <span className="text-xs text-slate-500 font-medium">{p.healthScore ?? 100}</span>
          </button>
        ))}
        {!projects.length && (
          <p className="text-xs text-slate-500 px-2 py-2">No projects yet</p>
        )}
      </div>

      {/* User */}
      <div className="p-3 border-t border-surface-600">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={onLogout} className="w-full mt-2 text-left px-2 py-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors rounded">
          Sign out
        </button>
      </div>
    </aside>
  );
}
