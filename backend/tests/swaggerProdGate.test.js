// The OpenAPI docs (Swagger UI at /api-docs + raw spec at /api-docs.json) are dev/staging tooling.
// In production they are NOT mounted: saves the boot-time swagger-jsdoc file scan + UI memory (matters
// on a 1GB micro instance) and avoids exposing the full API surface. Outside production they stay on.
//
// Tested against the isolated mountApiDocs helper (not the full app) on purpose: booting the whole app
// under NODE_ENV=production drags in the blockchain mainnet init, which is unrelated to this gate.
const express = require('express');
const request = require('supertest');
const { mountApiDocs } = require('../config/apiDocs');

describe('OpenAPI docs are gated out of production', () => {
  const OLD = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = OLD; });

  test('does NOT mount /api-docs.json in production (returns 404)', async () => {
    process.env.NODE_ENV = 'production';
    const app = express();
    const mounted = mountApiDocs(app);
    app.use((req, res) => res.status(404).end());
    expect(mounted).toBe(false);
    const res = await request(app).get('/api-docs.json');
    expect(res.status).toBe(404);
  });

  test('mounts the spec outside production', async () => {
    process.env.NODE_ENV = 'test';
    const app = express();
    const mounted = mountApiDocs(app);
    expect(mounted).toBe(true);
    const res = await request(app).get('/api-docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
  });
});
