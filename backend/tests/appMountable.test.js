// The app must be importable and serve requests WITHOUT opening a port,
// connecting to a DB, or starting jobs — the precondition for supertest.
require('./helpers/testEnv');
const request = require('supertest');
const app = require('../app');

describe('app is mountable', () => {
  test('GET /health returns 200 without a DB connection', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  test('unknown route returns the canonical 404 envelope', async () => {
    const res = await request(app).get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
});
