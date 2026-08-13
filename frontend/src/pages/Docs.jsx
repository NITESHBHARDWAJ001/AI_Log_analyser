import { Link } from 'react-router-dom';
import { useState } from 'react';

const Code = ({ children, lang = 'bash' }) => (
  <pre className="bg-surface-700 border border-surface-500 rounded-lg p-4 overflow-x-auto text-sm">
    <code className={`language-${lang} text-green-400 font-mono`}>{children}</code>
  </pre>
);

const Section = ({ id, title, children }) => (
  <section id={id} className="mb-12 scroll-mt-20">
    <h2 className="text-2xl font-bold text-white mb-4 pb-2 border-b border-surface-600">{title}</h2>
    {children}
  </section>
);

const Sub = ({ title, children }) => (
  <div className="mb-6">
    <h3 className="text-lg font-semibold text-brand-400 mb-3">{title}</h3>
    {children}
  </div>
);

const navItems = [
  { id: 'quickstart', label: 'Quick Start' },
  { id: 'installation', label: 'Installation' },
  { id: 'cli', label: 'CLI Usage' },
  { id: 'agent', label: 'Agent API' },
  { id: 'express', label: 'Express Integration' },
  { id: 'serviceMap', label: 'Service Map' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'api', label: 'REST API' },
  { id: 'socket', label: 'WebSocket Events' }
];

export default function Docs() {
  const [active, setActive] = useState('quickstart');

  return (
    <div className="min-h-screen bg-surface-900">
      {/* Top Nav */}
      <nav className="border-b border-surface-700 px-6 py-4 flex items-center justify-between sticky top-0 bg-surface-900/90 backdrop-blur z-50">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm">AQ</div>
          <span className="font-bold text-white">AutoQual <span className="text-brand-400">AI+</span></span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-slate-400 hover:text-white text-sm transition-colors">Home</Link>
          <Link to="/signup" className="btn-primary text-sm">Get Started</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10 flex gap-8">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 hidden lg:block">
          <div className="sticky top-24">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">On This Page</p>
            <nav className="space-y-1">
              {navItems.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActive(item.id)}
                  className={`block text-sm py-1 px-2 rounded transition-colors ${
                    active === item.id ? 'text-brand-400 bg-brand-500/10' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-3">Documentation</h1>
            <p className="text-slate-400 text-lg">Everything you need to integrate AutoQual AI+ into your production apps.</p>
          </div>

          <Section id="quickstart" title="Quick Start">
            <p className="text-slate-400 mb-4">Get monitoring in under 3 minutes.</p>
            <Code>{`# 1. Install the agent
npm install @hr_71_sharma/agent

# 2. Initialize project (interactive setup)
npx --yes --package @hr_71_sharma/agent autoqual init

# 3. Connect and verify
npx --yes --package @hr_71_sharma/agent autoqual connect`}</Code>
            <p className="text-slate-400 mt-4">After running <code className="text-brand-400 bg-surface-700 px-1 rounded">init</code>, follow the prompts to enter your API key and project ID from the dashboard.</p>
          </Section>

          <Section id="installation" title="Installation">
            <Sub title="NPM">
              <Code>{`npm install @hr_71_sharma/agent`}</Code>
            </Sub>
            <Sub title="Yarn">
              <Code>{`yarn add @hr_71_sharma/agent`}</Code>
            </Sub>
            <Sub title="Requirements">
              <ul className="list-disc list-inside text-slate-400 space-y-1 text-sm">
                <li>Node.js 16+</li>
                <li>An AutoQual account with API Key + Project ID</li>
                <li>Network access to your AutoQual backend</li>
              </ul>
            </Sub>
          </Section>

          <Section id="cli" title="CLI Usage">
            <p className="text-slate-400 mb-4">Run the CLI via npx (recommended) or install globally:</p>
            <Code>{`npx --yes --package @hr_71_sharma/agent autoqual <command> [options]`}</Code>

            <Sub title="Commands">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-surface-600">
                      <th className="text-left py-2 pr-4 text-slate-300 font-medium">Command</th>
                      <th className="text-left py-2 text-slate-300 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-400">
                    {[
                      ['autoqual init', 'Interactive setup wizard — saves .autoqual.json'],
                      ['autoqual connect', 'Test connection to backend using saved credentials'],
                      ['autoqual status', 'Show project status and recent log counts'],
                      ['autoqual send-test', 'Send a test log to verify the pipeline'],
                      ['autoqual --help', 'List all commands and options']
                    ].map(([cmd, desc]) => (
                      <tr key={cmd} className="border-b border-surface-700">
                        <td className="py-2 pr-4"><code className="text-brand-400 font-mono text-xs">{cmd}</code></td>
                        <td className="py-2">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Sub>

            <Sub title="Config file (.autoqual.json)">
              <Code lang="json">{`{
  "apiKey": "aq_your_api_key_here",
  "projectId": "proj_your_project_id",
  "baseUrl": "https://api.yourapp.com",
  "backendUrl": "http://localhost:5000"
}`}</Code>
            </Sub>
          </Section>

          <Section id="agent" title="Agent API">
            <Sub title="Initialize">
              <Code lang="javascript">{`const { AutoQualAgent } = require('@hr_71_sharma/agent');

AutoQualAgent.init({
  apiKey: 'aq_your_api_key',
  projectId: 'proj_your_id',
  baseUrl: 'https://api.yourapp.com',
  // Optional:
  backendUrl: 'http://localhost:5000',  // set this to your deployed backend URL in production
  flushInterval: 5000,       // ms between batch sends (default: 5000)
  maxBatchSize: 50,           // max logs per batch (default: 50)
  hookConsole: true,          // intercept console.log/error/warn (default: true)
  reportSystemMetrics: true,  // auto-report memory/CPU usage each flush (default: true)
  debug: false                // verbose agent logging (default: false)
});`}</Code>
              <p className="text-slate-400 text-sm mt-2">
                With <code className="text-brand-400 bg-surface-700 px-1 rounded">reportSystemMetrics</code> on, the agent samples process memory (% of system RAM) and CPU (% of one core) on every flush — no extra code needed. These feed the dashboard's memory-leak detection.
              </p>
            </Sub>

            <Sub title="Manual Logging">
              <Code lang="javascript">{`const { logger } = require('@hr_71_sharma/agent');

logger.info('User logged in', { userId: '123' });
logger.warn('Rate limit approaching', { current: 95, max: 100 });
logger.error('Payment failed', { orderId: 'ord_456', reason: 'Card declined' });
logger.debug('Cache miss for key user_session_789');`}</Code>
            </Sub>

            <Sub title="Shutdown gracefully">
              <Code lang="javascript">{`// Flush remaining logs before process exit
process.on('SIGTERM', async () => {
  await AutoQualAgent.flush();
  process.exit(0);
});`}</Code>
            </Sub>
          </Section>

          <Section id="express" title="Express Middleware">
            <p className="text-slate-400 mb-4">Automatically capture HTTP metrics for every request:</p>
            <Code lang="javascript">{`const express = require('express');
const { AutoQualAgent, autoQualMiddleware } = require('@hr_71_sharma/agent');

const app = express();

// Initialize agent first
AutoQualAgent.init({
  apiKey: process.env.AUTOQUAL_API_KEY,
  projectId: process.env.AUTOQUAL_PROJECT_ID,
  baseUrl: process.env.BASE_URL
});

// Add middleware BEFORE routes
app.use(autoQualMiddleware());

// Your routes
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});`}</Code>
            <p className="text-slate-400 mt-3 text-sm">The middleware captures: endpoint, method, status code, and response time automatically.</p>

            <Sub title="ML-based attack detection (opt-in)">
              <p className="text-slate-400 mb-3 text-sm">
                Enable <code className="text-brand-400 bg-surface-700 px-1 rounded">captureRawRequests</code> to feed
                method/headers/body/query into AutoQual's ML threat detection. Off by default — request bodies can
                carry sensitive data, so read the redaction options before turning this on.
              </p>
              <Code lang="javascript">{`AutoQualAgent.init({
  apiKey: process.env.AUTOQUAL_API_KEY,
  projectId: process.env.AUTOQUAL_PROJECT_ID,
  captureRawRequests: true,           // default: false
  captureRawRequestsSampleRate: 1,    // 0-1, lower on high-traffic apps
  redactHeaders: ['authorization', 'cookie', 'set-cookie'],   // stripped before sending, these are the defaults
  redactBodyFields: ['password', 'token', 'secret', 'apikey', 'ssn', 'creditcard', 'cvv']  // matched by substring, case-insensitive
});`}</Code>
              <p className="text-slate-400 mt-3 text-sm">
                Redaction happens in the agent, in your process, before anything leaves it — matching field names are
                replaced with <code className="text-brand-400 bg-surface-700 px-1 rounded">[REDACTED]</code> at any
                nesting depth in the body, and listed headers are stripped entirely.
              </p>
            </Sub>
          </Section>

          <Section id="serviceMap" title="Service Map">
            <p className="text-slate-400 mb-4">Map endpoints to source files for trace-level debugging in the dashboard.</p>
            <p className="text-slate-400 mb-3">Configure when creating a project via the API or setup wizard:</p>
            <Code lang="json">{`{
  "serviceMap": [
    { "endpoint": "/api/payment", "file": "services/paymentService.js", "line": 47 },
    { "endpoint": "/api/users",   "file": "controllers/userController.js", "line": 12 },
    { "endpoint": "/api/orders",  "file": "controllers/orderController.js", "line": 88 }
  ]
}`}</Code>
            <p className="text-slate-400 mt-3 text-sm">The dashboard Trace Engine shows: <code className="text-brand-400">/api/payment → paymentService.js:47</code></p>
          </Section>

          <Section id="alerts" title="Alerts Configuration">
            <Sub title="Threshold Settings">
              <Code lang="json">{`{
  "alertThresholds": {
    "errorRate": 5,          // % error rate to trigger alert
    "responseTime": 2000,    // ms to flag slow response
    "logErrorCount": 10      // error logs per window to spike alert
  },
  "alertEmail": "ops-team@yourcompany.com"
}`}</Code>
            </Sub>
            <Sub title="Alert Severities">
              <div className="flex gap-3 flex-wrap">
                <span className="badge-critical">critical — email + dashboard banner</span>
                <span className="badge-high">high — dashboard banner</span>
                <span className="badge-medium">medium — toast notification</span>
                <span className="badge-low">low — log entry only</span>
              </div>
            </Sub>
          </Section>

          <Section id="api" title="REST API">
            <p className="text-slate-400 mb-4">All endpoints require <code className="text-brand-400">Authorization: Bearer &lt;jwt_token&gt;</code> except <code className="text-brand-400">/api/ingest</code> which uses your agent API key.</p>

            {[
              { method: 'POST', path: '/api/auth/signup', desc: 'Create account' },
              { method: 'POST', path: '/api/auth/login', desc: 'Login, returns JWT' },
              { method: 'GET',  path: '/api/auth/me', desc: 'Get current user' },
              { method: 'GET',  path: '/api/teams', desc: 'List your teams' },
              { method: 'POST', path: '/api/teams', desc: 'Create a team' },
              { method: 'GET',  path: '/api/projects', desc: 'List your projects' },
              { method: 'POST', path: '/api/projects', desc: 'Create a project' },
              { method: 'POST', path: '/api/ingest', desc: 'Ingest logs & metrics (agent key)' },
              { method: 'GET',  path: '/api/dashboard/:projectId/overview', desc: 'Project overview stats' },
              { method: 'GET',  path: '/api/dashboard/:projectId/logs', desc: 'Recent logs' },
              { method: 'GET',  path: '/api/dashboard/:projectId/metrics', desc: 'Metrics + endpoint stats' },
              { method: 'GET',  path: '/api/alerts?projectId=xxx', desc: 'List alerts' },
              { method: 'POST', path: '/api/reports/generate', desc: 'Trigger daily report' }
            ].map(({ method, path, desc }) => (
              <div key={path} className="flex items-start gap-3 py-2 border-b border-surface-700 text-sm">
                <span className={`flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded font-mono ${
                  method === 'GET' ? 'bg-blue-500/20 text-blue-400' :
                  method === 'POST' ? 'bg-green-500/20 text-green-400' :
                  method === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-red-500/20 text-red-400'
                }`}>{method}</span>
                <code className="text-brand-400 font-mono flex-shrink-0">{path}</code>
                <span className="text-slate-400">{desc}</span>
              </div>
            ))}
          </Section>

          <Section id="socket" title="WebSocket Events">
            <p className="text-slate-400 mb-4">Connect via Socket.io and join a project room to receive real-time updates.</p>
            <Code lang="javascript">{`import { io } from 'socket.io-client';

const socket = io('https://YOUR_RENDER_BACKEND_URL', {
  auth: { token: 'your_jwt_token' }
});

socket.on('connect', () => {
  socket.emit('join-project', 'proj_yourprojectid');
});

socket.on('log-update',      (log)     => console.log('New log:', log));
socket.on('metrics-update',  (metric)  => console.log('Metric:', metric));
socket.on('issue-detected',  (issue)   => console.log('Issue:', issue));
socket.on('alert-new',       (alert)   => console.log('Alert:', alert));
socket.on('health-update',   (health)  => console.log('Health:', health));
socket.on('ai-analysis-result', ({ issueId, rootCause, suggestion, codeSnippet, summary }) => {
  // AI root-cause analysis, already computed server-side via Groq
});
socket.on('report-generated', ({ reportId, stats, aiSummary }) => {
  // Daily report, aiSummary already computed server-side via Groq
});`}</Code>
          </Section>
        </main>
      </div>
    </div>
  );
}
