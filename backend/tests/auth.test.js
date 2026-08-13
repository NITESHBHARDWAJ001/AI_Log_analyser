const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const { app, waitForDb, mongoose } = require('./helpers/testApp');

const email = `test-${crypto.randomUUID()}@example.com`;
const password = 'password123';

test.before(async () => { await waitForDb(); });
test.after(async () => { await mongoose.connection.close(); });

test('signup creates a user and returns a token', async () => {
  const res = await request(app).post('/api/auth/signup').send({ name: 'Test User', email, password });
  assert.equal(res.status, 201);
  assert.ok(res.body.token);
  assert.equal(res.body.user.email, email);
  assert.equal(res.body.user.password, undefined);
});

test('signup rejects a duplicate email', async () => {
  const res = await request(app).post('/api/auth/signup').send({ name: 'Test User', email, password });
  assert.equal(res.status, 409);
});

test('login succeeds with correct credentials', async () => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
});

test('login rejects an incorrect password', async () => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'wrongpassword' });
  assert.equal(res.status, 401);
});

test('GET /api/auth/me requires a token', async () => {
  const res = await request(app).get('/api/auth/me');
  assert.equal(res.status, 401);
});

test('GET /api/auth/me returns the user with a valid token', async () => {
  const login = await request(app).post('/api/auth/login').send({ email, password });
  const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.user.email, email);
});
