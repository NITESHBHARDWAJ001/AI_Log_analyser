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
```

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

## Publishing the agent (maintainers)

```bash
cd agent
npm publish --access public
```

If you see `E403 ... bypass 2fa required`, create a **Granular Access Token** on npm with `Read/Write` + `Bypass 2FA`, or publish with `--otp`.

Security:
- Never commit `.env`, `.autoqual.json`, or npm tokens.
- If a token is pasted into chat or a terminal log, revoke it immediately.
