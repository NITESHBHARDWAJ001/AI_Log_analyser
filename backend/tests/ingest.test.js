const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const { app, waitForDb, mongoose } = require('./helpers/testApp');

const email = `ingest-${crypto.randomUUID()}@example.com`;
const password = 'password123';
let project;

test.before(async () => {
  await waitForDb();

  const signup = await request(app).post('/api/auth/signup').send({ name: 'Ingest Tester', email, password });
  const token = signup.body.token;

  const team = await request(app).post('/api/teams')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Ingest Team' });

  const proj = await request(app).post('/api/projects')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Ingest Project', baseUrl: 'http://localhost:4000', teamId: team.body.team._id });

  project = proj.body.project;
});

// Ingest triggers fire-and-forget watcher analysis; give it a tick to settle
// before tearing down the connection so it doesn't log a spurious close error.
test.after(async () => {
  await new Promise(resolve => setTimeout(resolve, 300));
  await mongoose.connection.close();
});

test('rejects ingest with no Authorization header', async () => {
  const res = await request(app).post('/api/ingest').send({ projectId: project.projectId, logs: [] });
  assert.equal(res.status, 401);
});

test('rejects ingest with an invalid API key', async () => {
  const res = await request(app).post('/api/ingest')
    .set('Authorization', 'Bearer aq_totally_wrong_key')
    .send({ projectId: project.projectId, logs: [] });
  assert.equal(res.status, 401);
});

test('accepts ingest with a valid API key and stores the log', async () => {
  const res = await request(app).post('/api/ingest')
    .set('Authorization', `Bearer ${project.apiKey}`)
    .send({
      projectId: project.projectId,
      logs: [{ level: 'info', message: 'hello from test' }]
    });
  assert.equal(res.status, 200);
  assert.equal(res.body.logsIngested, 1);
  assert.equal(res.body.metricsIngested, 0);
});
