const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, waitForDb, mongoose } = require('./helpers/testApp');

test.before(async () => { await waitForDb(); });
test.after(async () => { await mongoose.connection.close(); });

test('GET /health returns ok', async () => {
  const res = await request(app).get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});
