// A small, realistic target app with the real AutoQual agent installed — this is
// what gets monitored. Point traffic-generator.js (or curl, or a browser) at this
// server, and watch it show up on the AutoQual dashboard in real time.
//
// Env vars (see .env.example):
//   AUTOQUAL_API_KEY, AUTOQUAL_PROJECT_ID  — required, from `npm run seed` in backend/
//   AUTOQUAL_BACKEND_URL                    — default http://localhost:5000
//   PORT                                    — default 4010

require('dotenv').config();
const express = require('express');
const { AutoQualAgent, autoQualMiddleware } = require('../agent/src/index');

const PORT = process.env.PORT || 4010;

if (!process.env.AUTOQUAL_API_KEY || !process.env.AUTOQUAL_PROJECT_ID) {
  console.error('[dummy-server] Missing AUTOQUAL_API_KEY / AUTOQUAL_PROJECT_ID.');
  console.error('[dummy-server] Run `npm run seed` in backend/ and copy the printed');
  console.error('[dummy-server] values into dummy-server/.env (see .env.example).');
  process.exit(1);
}

AutoQualAgent.init({
  apiKey: process.env.AUTOQUAL_API_KEY,
  projectId: process.env.AUTOQUAL_PROJECT_ID,
  backendUrl: process.env.AUTOQUAL_BACKEND_URL || 'http://localhost:5000',
  flushInterval: 2000,
  hookConsole: false,
  captureRawRequests: true,       // this app exists to be monitored — opt in for real
  captureRawRequestsSampleRate: 1,
  debug: process.env.AUTOQUAL_DEBUG === 'true'
});

const app = express();
app.set('trust proxy', true); // respects X-Forwarded-For — traffic-generator.js uses this to simulate different source IPs
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(autoQualMiddleware());

// ---------------------------------------------------------------------------
// Fake data
// ---------------------------------------------------------------------------
const PRODUCTS = [
  { id: 1, name: 'Running Shoes', price: 79.99 },
  { id: 2, name: 'Water Bottle', price: 14.5 },
  { id: 3, name: 'Yoga Mat', price: 29.0 },
];
const DEMO_USER = { username: 'jane_doe', password: 'correct-horse-battery-staple' };
const ADMIN_TOKEN = 'admin-demo-token';

// ---------------------------------------------------------------------------
// Routes — deliberately ordinary. Nothing here is actually vulnerable; the point
// is to generate real HTTP traffic for the agent to capture and classify, not to
// have a real SQL injection to exploit.
// ---------------------------------------------------------------------------
app.get('/', (req, res) => res.json({ status: 'ok', app: 'autoqual-dummy-server' }));

app.get('/products', (req, res) => {
  const { search } = req.query;
  const results = search
    ? PRODUCTS.filter(p => p.name.toLowerCase().includes(String(search).toLowerCase()))
    : PRODUCTS;
  res.json({ results });
});

app.get('/products/:id', (req, res) => {
  const product = PRODUCTS.find(p => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Not found' });
  res.json(product);
});

app.get('/search', (req, res) => {
  res.json({ query: req.query.q || '', results: [] });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === DEMO_USER.username && password === DEMO_USER.password) {
    return res.json({ ok: true, token: 'demo-session-token' });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/checkout', (req, res) => {
  const { productId, quantity } = req.body || {};
  const product = PRODUCTS.find(p => p.id === Number(productId));
  if (!product) return res.status(400).json({ error: 'Unknown product' });
  res.json({ ok: true, total: product.price * (Number(quantity) || 1) });
});

app.get('/admin/users', (req, res) => {
  if (req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ users: [DEMO_USER.username] });
});

app.listen(PORT, () => {
  console.log(`[dummy-server] listening on :${PORT}`);
  console.log(`[dummy-server] reporting to ${process.env.AUTOQUAL_BACKEND_URL || 'http://localhost:5000'} as project ${process.env.AUTOQUAL_PROJECT_ID}`);
});
