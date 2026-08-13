# AutoQual AI+ — Code-Aware Quality Intelligence Platform

AutoQual is a full-stack monitoring + observability platform with a Node.js agent.

## Repo layout

```
/backend    Node.js + Express + MongoDB + Socket.io
/frontend   React + Tailwind + Recharts (Vite)
/agent      @hr_71_sharma/agent (npm package + autoqual CLI)
```

## Prerequisites

- Node.js 16+ (18+ recommended)
- npm
- MongoDB running locally (or via Docker)

## Local setup (run the platform)

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend runs on: http://localhost:5000
Health check: http://localhost:5000/health

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: http://localhost:3000

Notes:
- Frontend dev server proxies `/api` and `/socket.io` to `http://localhost:5000`.
- Make sure `FRONTEND_URL=http://localhost:3000` in `backend/.env` for CORS.

### 3) Create access credentials (API Key + Project ID)

Open the frontend → sign up → create team → create project.
You’ll get:
- **API Key** (format: `aq_...`)
- **Project ID** (format: `proj_...`)

## Environment variables

Backend uses `backend/.env` (do not commit it). Start from `backend/.env.example`.

Common vars:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/autoqual
JWT_SECRET=change_me
SMTP_HOST=smtp.gmail.com
SMTP_USER=you@email.com
SMTP_PASS=your_app_password
FRONTEND_URL=http://localhost:3000
GROQ_API_KEY=your_groq_api_key
GROQ_FALLBACK_KEYS=optional_fallback_key1,optional_fallback_key2
GROQ_MODEL=llama-3.3-70b-versatile
```

AI root-cause analysis and report summaries run server-side via [Groq](https://console.groq.com/) (`GROQ_API_KEY`). `GROQ_FALLBACK_KEYS` (comma-separated) are tried in order if the primary key fails or is rate-limited. Without a configured key, AI analysis fails silently and the rest of the platform (ingestion, alerts, dashboards) keeps working.

## Seed demo data

```bash
cd backend
npm run seed
```

Creates a demo user/team/project with sample logs, metrics, and one issue. Prints the demo login and API key/Project ID on completion. Safe to re-run — it clears its own previous demo data first.

## Tests

```bash
cd backend
npm test
```

Runs against an isolated `autoqual_test` database (not your dev data) using Node's built-in test runner + supertest. Covers auth (signup/login/me), ingest (API key auth), and the health check.

## Install the agent (in any Node.js app)

```bash
npm install @hr_71_sharma/agent
```

```js
const { AutoQualAgent, autoQualMiddleware } = require('@hr_71_sharma/agent');

AutoQualAgent.init({
  apiKey: 'aq_your_api_key',
  projectId: 'proj_your_id',
  backendUrl: 'http://localhost:5000',
  hookConsole: true,
  debug: false
});

// Express:
app.use(autoQualMiddleware());
```

## Agent CLI

The CLI stores config in `.autoqual.json` in your current folder (keep it out of git).

Run with npx (recommended):

```bash
npx --yes --package @hr_71_sharma/agent autoqual init
npx --yes --package @hr_71_sharma/agent autoqual status
npx --yes --package @hr_71_sharma/agent autoqual connect
npx --yes --package @hr_71_sharma/agent autoqual send-test
```

Or install globally:

```bash
npm i -g @hr_71_sharma/agent
autoqual init
```

## Smoke test the published agent

A non-interactive smoke test script is included at repo root:

```bash
node smoke-test-agent.js
```

It installs `@hr_71_sharma/agent@1.0.0` into a temp folder, starts a mock backend, runs CLI commands, and verifies `require()` + `init()`.

## Deploying (Render backend + Vercel frontend)

### Backend on Render

Create a **Web Service** pointing at this repo.

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`

Set environment variables in Render (minimum):
- `MONGODB_URI` (use MongoDB Atlas or Render Mongo)
- `JWT_SECRET` (strong random)
- `FRONTEND_URL` = `https://YOUR_VERCEL_DOMAIN` (you can also pass comma-separated origins)

Optional (email + reports):
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`
- `REPORT_CRON`

After deploy, verify:
- `GET https://YOUR_RENDER_BACKEND_URL/health` returns `{ status: "ok" }`

Notes / gotchas:
- If you scale backend to multiple instances, `startReportScheduler()` will run in every instance. Keep instance count = 1, or add a guard (recommended) before scaling.

### Frontend on Vercel

Deploy the `frontend` directory.

Set an environment variable in Vercel:
- `VITE_BACKEND_URL` = `https://YOUR_RENDER_BACKEND_URL`

This repo’s frontend will use:
- API base: `${VITE_BACKEND_URL}/api` in production
- Socket.io: connects to `VITE_BACKEND_URL` in production

## Agent in production (published npm package)

You do **not** need to republish the agent just to deploy the platform.

What changes in production is the config you pass:
- In your app using the agent, set `backendUrl` to your Render backend URL.
- In the CLI, set `backendUrl` in `.autoqual.json` to the Render backend URL.

Example:

```js
AutoQualAgent.init({
  apiKey: process.env.AUTOQUAL_API_KEY,
  projectId: process.env.AUTOQUAL_PROJECT_ID,
  backendUrl: 'https://YOUR_RENDER_BACKEND_URL',
  hookConsole: true
});
```

The agent source (CLI messages, Sender User-Agent header) already reflects the `@hr_71_sharma/agent` name. If you've published `1.0.0` under the old name, publish `1.0.1` to push these fixes to npm.

## Publishing the agent (maintainers)

```bash
cd agent
npm publish --access public
```

If you see `E403 ... bypass 2fa required`, create a **Granular Access Token** on npm with `Read/Write` + `Bypass 2FA`, or publish with `--otp`.

Security:
- Never commit `.env`, `.autoqual.json`, or npm tokens.
- If a token is pasted into chat or a terminal log, revoke it immediately.
