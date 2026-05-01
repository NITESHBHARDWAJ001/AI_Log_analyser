import { Link } from 'react-router-dom';

const Feature = ({ icon, title, desc }) => (
  <div className="card hover:border-brand-500/50 transition-colors group">
    <div className="text-3xl mb-3">{icon}</div>
    <h3 className="font-semibold text-white mb-1 group-hover:text-brand-400 transition-colors">{title}</h3>
    <p className="text-slate-400 text-sm">{desc}</p>
  </div>
);

const Step = ({ n, title, code }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-bold flex items-center justify-center">{n}</div>
    <div className="flex-1">
      <p className="font-medium text-white mb-1">{title}</p>
      {code && (
        <code className="block bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-sm text-brand-400 font-mono">
          {code}
        </code>
      )}
    </div>
  </div>
);

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface-900">
      {/* Navbar */}
      <nav className="border-b border-surface-700 px-6 py-4 flex items-center justify-between sticky top-0 bg-surface-900/80 backdrop-blur z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">AQ</div>
          <span className="font-bold text-white text-lg">AutoQual <span className="text-brand-400">AI+</span></span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/docs" className="text-slate-400 hover:text-white transition-colors text-sm">Docs</Link>
          <Link to="/login" className="text-slate-400 hover:text-white transition-colors text-sm">Login</Link>
          <Link to="/signup" className="btn-primary text-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/30 rounded-full px-4 py-1.5 text-brand-400 text-sm mb-8">
          <span className="w-2 h-2 bg-brand-400 rounded-full animate-pulse" />
          Powered by Grok AI — Real-time Code Intelligence
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight">
          Code-Aware Quality<br />
          <span className="text-gradient">Intelligence Platform</span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
          Monitor production apps in real-time. Get AI-powered root cause analysis, instant alerts, and daily reports — all from a single dashboard.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link to="/signup" className="btn-primary text-base px-6 py-3">
            Start for Free →
          </Link>
          <Link to="/docs" className="btn-secondary text-base px-6 py-3">
            View Docs
          </Link>
        </div>

        {/* Dashboard preview mockup */}
        <div className="mt-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-surface-900 z-10 pointer-events-none" style={{ top: '60%' }} />
          <div className="card border-surface-500 overflow-hidden glow">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-slate-500 text-xs ml-2">AutoQual Dashboard — Production</span>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Health Score', value: '94', color: 'text-green-400', sub: '+2% today' },
                { label: 'Requests/min', value: '1,247', color: 'text-blue-400', sub: 'Live' },
                { label: 'Error Rate', value: '0.3%', color: 'text-yellow-400', sub: '↓ improving' },
                { label: 'Avg Response', value: '124ms', color: 'text-brand-400', sub: 'p95: 312ms' }
              ].map(m => (
                <div key={m.label} className="bg-surface-700 rounded-lg p-3 text-center">
                  <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
                  <div className="text-slate-400 text-xs mt-1">{m.label}</div>
                  <div className="text-slate-500 text-xs">{m.sub}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 bg-surface-700 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-2">Live Logs</div>
                {[
                  { level: 'info', msg: 'GET /api/users 200 45ms' },
                  { level: 'warn', msg: 'Slow query detected: 890ms' },
                  { level: 'error', msg: 'Unhandled rejection in paymentService' },
                  { level: 'info', msg: 'POST /api/orders 201 112ms' },
                  { level: 'debug', msg: 'Cache hit: user_session_7f2a' }
                ].map((l, i) => (
                  <div key={i} className={`text-xs font-mono mb-1 log-${l.level}`}>
                    [{l.level.toUpperCase()}] {l.msg}
                  </div>
                ))}
              </div>
              <div className="col-span-1 bg-surface-700 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-2">AI Insight</div>
                <div className="text-xs text-brand-300 mb-2">🤖 Root Cause Detected:</div>
                <p className="text-xs text-slate-300">
                  Payment service throwing unhandled promise rejection in <code className="text-brand-400">paymentService.js:47</code>.
                  Likely caused by expired Stripe API key. Rotate key and add error boundary.
                </p>
              </div>
              <div className="col-span-1 bg-surface-700 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-2">Alerts</div>
                {[
                  { msg: 'Error spike on /payment', sev: 'critical' },
                  { msg: 'Memory usage at 87%', sev: 'high' },
                  { msg: 'Slow response /search', sev: 'medium' }
                ].map((a, i) => (
                  <div key={i} className={`text-xs mb-2 flex items-center gap-2 badge-${a.sev}`}>
                    <span className="capitalize">{a.sev}</span>
                    <span className="text-slate-300">{a.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-white text-center mb-4">Everything You Need</h2>
        <p className="text-slate-400 text-center mb-12">One platform. Full observability.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Feature icon="⚡" title="Real-time Monitoring" desc="WebSocket-powered live log streaming and metric updates the moment they happen." />
          <Feature icon="🤖" title="AI Root Cause Analysis" desc="Grok AI analyzes issues and generates specific fix suggestions with code snippets." />
          <Feature icon="🔍" title="Trace Engine" desc="Maps endpoints to source files and line numbers via your serviceMap configuration." />
          <Feature icon="🚨" title="Smart Alerts" desc="Critical alerts trigger instant email notifications and dashboard banners." />
          <Feature icon="📊" title="Daily Reports" desc="Automated daily health reports with AI summaries emailed to your whole team." />
          <Feature icon="📦" title="NPM Agent" desc="One-line setup. Drop the agent into any Node.js app and start monitoring immediately." />
        </div>
      </section>

      {/* Quick Start */}
      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-4">Get Running in 3 Minutes</h2>
        <p className="text-slate-400 text-center mb-10">No infra to manage. Just install, configure, and go.</p>
        <div className="card space-y-6">
          <Step n={1} title="Install the agent" code="npm install @autoqual/agent" />
          <Step n={2} title="Initialize your project" code="npx autoqual init" />
          <Step n={3} title="Add to your app" code={`const { AutoQualAgent } = require('@autoqual/agent');\nAutoQualAgent.init({ apiKey: 'aq_...', projectId: 'proj_...' });`} />
          <Step n={4} title="Open your dashboard and watch logs roll in live" />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="card border-brand-500/30 glow">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to ship with confidence?</h2>
          <p className="text-slate-400 mb-8">Join teams using AutoQual AI+ to catch issues before users do.</p>
          <Link to="/signup" className="btn-primary text-lg px-8 py-3">
            Create Free Account →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-700 px-6 py-8 text-center text-slate-500 text-sm">
        <p>© 2025 AutoQual AI+ — Code-Aware Quality Intelligence Platform</p>
        <div className="flex items-center justify-center gap-6 mt-3">
          <Link to="/docs" className="hover:text-slate-300 transition-colors">Docs</Link>
          <a href="https://www.npmjs.com/package/@autoqual/agent" target="_blank" rel="noreferrer" className="hover:text-slate-300 transition-colors">NPM</a>
          <Link to="/signup" className="hover:text-slate-300 transition-colors">Sign Up</Link>
        </div>
      </footer>
    </div>
  );
}
