/*
  AutoQual Agent smoke test (published package)

  What it does:
  1) Creates a temp folder
  2) npm init + installs @hr_71_sharma/agent@1.0.0
  3) Starts a mock backend (GET /health, POST /api/ingest)
  4) Writes .autoqual.json pointing to the mock backend
  5) Runs CLI commands: status, connect, send-test
  6) Verifies the library can be required and initialized

  Run:
    node smoke-test-agent.js
*/

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawnSync } = require('child_process');

const PKG = '@hr_71_sharma/agent@1.0.0';

function cmdName(base) {
  return process.platform === 'win32' ? `${base}.cmd` : base;
}

function run(exe, args, opts = {}) {
  const res = spawnSync(exe, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    ...opts
  });

  if (opts.print !== false) {
    if (res.stdout) process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
  }

  return res;
}

function fail(msg) {
  process.stderr.write(`\n[smoke-test] FAIL: ${msg}\n`);
  process.exit(1);
}

function ok(msg) {
  process.stdout.write(`[smoke-test] OK: ${msg}\n`);
}

(async function main() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoqual-agent-smoke-'));
  ok(`Working dir: ${workDir}`);

  // Start mock backend
  const port = 5055;
  let ingestCalls = 0;

  const server = http.createServer((req, res) => {
    const url = req.url || '/';

    if (req.method === 'GET' && url.startsWith('/health')) {
      const body = JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(body);
    }

    if (req.method === 'POST' && url.startsWith('/api/ingest')) {
      ingestCalls++;
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found', path: url }));
  });

  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  ok(`Mock backend listening: http://127.0.0.1:${port}`);

  try {
    // npm init + install
    const npm = cmdName('npm');

    let r;

    r = run(npm, ['init', '-y'], { cwd: workDir, print: false });
    if (r.status !== 0) fail(`npm init failed (exit ${r.status})`);

    r = run(npm, ['i', '--silent', PKG], { cwd: workDir, print: true });
    if (r.status !== 0) fail(`npm install ${PKG} failed (exit ${r.status})`);
    ok(`Installed ${PKG}`);

    // Locate installed package and CLI path
    const pkgJsonPath = require.resolve('@hr_71_sharma/agent/package.json', { paths: [workDir] });
    const pkgDir = path.dirname(pkgJsonPath);
    const cliPath = path.join(pkgDir, 'bin', 'cli.js');

    if (!fs.existsSync(cliPath)) fail(`CLI not found at ${cliPath}`);

    // Write .autoqual.json (avoid interactive init)
    const cfg = {
      apiKey: 'aq_smoke_test_key',
      projectId: 'proj_smoke_test',
      baseUrl: 'http://localhost:3000',
      backendUrl: `http://127.0.0.1:${port}`
    };
    fs.writeFileSync(path.join(workDir, '.autoqual.json'), JSON.stringify(cfg, null, 2));
    ok('Wrote .autoqual.json');

    const node = process.execPath;

    // CLI --version
    r = run(node, [cliPath, '--version'], { cwd: workDir, print: true });
    if (r.status !== 0) fail(`autoqual --version failed (exit ${r.status})`);
    ok('CLI --version works');

    // status (checks /health)
    r = run(node, [cliPath, 'status'], { cwd: workDir, print: true });
    if (r.status !== 0) fail(`autoqual status failed (exit ${r.status})`);
    ok('CLI status works');

    // connect (calls /health + POST /api/ingest)
    r = run(node, [cliPath, 'connect'], { cwd: workDir, print: true });
    if (r.status !== 0) fail(`autoqual connect failed (exit ${r.status})`);
    ok('CLI connect works');

    // send-test (POST /api/ingest)
    r = run(node, [cliPath, 'send-test'], { cwd: workDir, print: true });
    if (r.status !== 0) fail(`autoqual send-test failed (exit ${r.status})`);
    ok('CLI send-test works');

    // Require/import check
    const testRequire = path.join(workDir, 'require-test.js');
    fs.writeFileSync(
      testRequire,
      `const { AutoQualAgent, autoQualMiddleware, logger } = require('@hr_71_sharma/agent');\n` +
        `if (typeof AutoQualAgent?.init !== 'function') throw new Error('AutoQualAgent.init missing');\n` +
        `if (typeof autoQualMiddleware !== 'function') throw new Error('autoQualMiddleware missing');\n` +
        `AutoQualAgent.init({ apiKey: 'aq_x', projectId: 'proj_x', backendUrl: 'http://127.0.0.1:${port}', debug: false, hookConsole: false });\n` +
        `const mw = autoQualMiddleware();\n` +
        `if (typeof mw !== 'function') throw new Error('middleware not a function');\n` +
        `logger.info('smoke-test logger ok');\n` +
        `console.log('require/init OK');\n`
    );

    r = run(node, [testRequire], { cwd: workDir, print: true });
    if (r.status !== 0) fail(`require/init test failed (exit ${r.status})`);
    ok('Library require/init works');

    if (ingestCalls < 2) fail(`Expected ingest to be called at least 2 times, got ${ingestCalls}`);
    ok(`Mock ingest received ${ingestCalls} calls`);

    process.stdout.write('\n[smoke-test] PASS ✅ Agent package looks healthy.\n');
  } finally {
    server.close();
  }
})();
