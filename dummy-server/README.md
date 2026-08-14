# AutoQual Dummy Server

A small, ordinary Express app with the real `@hr_71_sharma/agent` installed — this is
what gets monitored. It's not vulnerable to anything; the point is to generate real HTTP
traffic that the agent captures and reports, so you can watch detection happen live on the
dashboard instead of writing a new one-off test script every time.

## Setup

```bash
cd dummy-server
npm install
cp .env.example .env
```

Get real credentials by seeding a demo project in the backend, then paste them into `.env`:

```bash
cd ../backend
npm run seed
```

## Run it

```bash
cd dummy-server
npm start
```

Requires the real backend (and ideally `ml-service`) already running — see the root
`README.md` / `DEMO.md`.

## Generate traffic

```bash
npm run traffic benign      # normal browsing — should never create an issue
npm run traffic attacks     # one-shot SQLi / XSS / path traversal / command injection / sqlmap UA
npm run traffic bruteforce  # 5 failed logins + 1 success from one IP -> credential stuffing alert
npm run traffic ddos        # 100 rapid requests from one IP -> DDoS alert
npm run traffic scan        # 15 distinct endpoints from one IP -> scanning alert
npm run traffic all         # everything above, in order
```

Watch the dashboard (or query `GET /api/dashboard/:projectId/issues`) — each scenario
should produce exactly the Issue type its name implies, and `benign` should produce none.
This is the same set of scenarios used to verify the detection pipeline throughout
development; running them again after any change to `watcherService.js`,
`patternDetectionService.js`, `sequenceDetectionService.js`, or either ML model is the
fastest way to catch a regression before it reaches a real demo.

## Routes

| Route | Method | Notes |
|---|---|---|
| `/products` | GET | optional `?search=` |
| `/products/:id` | GET | |
| `/search` | GET | `?q=` — reflects the query, doesn't execute it (not actually vulnerable) |
| `/login` | POST | `{ username, password }` — only `jane_doe` / `correct-horse-battery-staple` succeeds |
| `/checkout` | POST | `{ productId, quantity }` |
| `/admin/users` | GET | requires `Authorization: Bearer admin-demo-token`, else 401 |

## Simulating multiple attacker IPs

`traffic-generator.js` sends requests with an `X-Forwarded-For` header, and the server has
`trust proxy` enabled, so `req.ip` (and therefore the agent's `clientIp` capture) respects
it — this is what lets `bruteforce`/`ddos`/`scan` simulate a single consistent attacker
identity without actually running from a different machine.
