// Sends real HTTP traffic to the dummy server (not directly to the backend) — this
// exercises the whole real path: your code -> agent middleware -> backend ingest ->
// detection -> dashboard. Reusable instead of writing a new scratch script each time.
//
// Usage:
//   node traffic-generator.js benign       - normal browsing traffic
//   node traffic-generator.js attacks      - one-shot SQLi/XSS/traversal/cmdi/tool-UA requests
//   node traffic-generator.js bruteforce   - 5 failed logins + 1 success from one IP
//   node traffic-generator.js ddos         - 100 rapid requests from one IP
//   node traffic-generator.js scan         - 15 distinct endpoints from one IP
//   node traffic-generator.js all          - everything above, in order

const BASE = process.env.DUMMY_SERVER_URL || 'http://localhost:4010';

const get = (path, ip) => fetch(`${BASE}${path}`, {
  headers: ip ? { 'X-Forwarded-For': ip } : {}
});

const post = (path, body, ip) => fetch(`${BASE}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(ip ? { 'X-Forwarded-For': ip } : {}) },
  body: JSON.stringify(body)
});

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function benign() {
  console.log('--- benign traffic ---');
  await get('/products');
  await get('/products?search=shoes');
  await get('/products/1');
  await get('/search?q=running+shoes+size+10');
  await post('/login', { username: 'jane_doe', password: 'correct-horse-battery-staple' });
  await post('/checkout', { productId: 1, quantity: 2 });
  console.log('sent 6 benign requests');
}

async function attacks() {
  console.log('--- one-shot attacks ---');
  const cases = [
    ['SQLi', () => get("/search?q=1' UNION SELECT username,password FROM users--")],
    ['XSS', () => get('/search?q=<script>alert(document.cookie)</script>')],
    ['Path traversal', () => get('/search?q=../../../../etc/passwd')],
    ['Command injection', () => get('/search?q=127.0.0.1;cat /etc/shadow')],
    ['Known attack tool UA', () => fetch(`${BASE}/products`, { headers: { 'User-Agent': 'sqlmap/1.7.2' } })],
  ];
  for (const [name, fn] of cases) {
    await fn();
    console.log('sent:', name);
  }
}

async function bruteforce() {
  console.log('--- brute force + credential stuffing success ---');
  const ip = '198.51.100.42';
  for (let i = 0; i < 5; i++) {
    await post('/login', { username: 'jane_doe', password: `guess${i}` }, ip);
  }
  await post('/login', { username: 'jane_doe', password: 'correct-horse-battery-staple' }, ip);
  console.log('sent 5 failed logins + 1 success from', ip);
}

async function ddos() {
  console.log('--- DDoS flood ---');
  const ip = '203.0.113.77';
  for (let i = 0; i < 100; i++) {
    await get('/products', ip);
  }
  console.log('sent 100 requests from', ip);
}

async function scan() {
  console.log('--- endpoint scanning ---');
  const ip = '198.51.100.5';
  for (let i = 0; i < 15; i++) {
    await get(`/nonexistent-path-${i}`, ip);
  }
  console.log('sent 15 distinct-endpoint requests from', ip);
}

const SCENARIOS = { benign, attacks, bruteforce, ddos, scan };

async function main() {
  const name = process.argv[2] || 'benign';
  if (name === 'all') {
    for (const fn of Object.values(SCENARIOS)) {
      await fn();
      await wait(500);
    }
    return;
  }
  const fn = SCENARIOS[name];
  if (!fn) {
    console.error(`Unknown scenario "${name}". Options: ${Object.keys(SCENARIOS).join(', ')}, all`);
    process.exit(1);
  }
  await fn();
}

main().catch(err => { console.error(err); process.exit(1); });
