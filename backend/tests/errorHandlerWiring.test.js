// backend/tests/errorHandlerWiring.test.js
const request = require('supertest');
const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const errorHandler = require('../middleware/errorHandler');

// Reproduces server.js's tail wiring: routes -> 404 -> errorHandler.
function buildApp() {
  const app = express();
  app.get('/boom', asyncHandler(async () => { throw new Error('secret detail'); }));
  app.get('/known', asyncHandler(async () => { throw new AppError(400, 'INVALID_ORDER', 'bad'); }));
  app.use('*', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
  app.use(errorHandler);
  return app;
}

test('unexpected error -> sanitized 500, no leak', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = await request(buildApp()).get('/boom');
  expect(res.status).toBe(500);
  expect(res.body.error.code).toBe('INTERNAL_ERROR');
  expect(res.text).not.toContain('secret detail');
  spy.mockRestore();
});

test('AppError -> coded response', async () => {
  const res = await request(buildApp()).get('/known');
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ error: { code: 'INVALID_ORDER', message: 'bad' } });
});

test('unknown route -> canonical 404 envelope', async () => {
  const res = await request(buildApp()).get('/nope');
  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
});
