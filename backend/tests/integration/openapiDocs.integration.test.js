// Verifica que la doc OpenAPI se sirve de verdad desde la app (el spec en JSON y
// la UI de Swagger). No toca la DB, pero corre en el harness de integración
// porque necesita la app real montada.
require('../helpers/testEnv');
const request = require('supertest');
const app = require('../../app');

test('GET /api-docs.json sirve el spec OpenAPI con los paths anotados', async () => {
  const res = await request(app).get('/api-docs.json');
  expect(res.status).toBe(200);
  expect(res.body.openapi).toMatch(/^3\./);
  expect(res.body.paths['/balances/my/balances']).toBeDefined();
  expect(res.body.components.schemas.ErrorEnvelope).toBeDefined();
});

test('GET /api-docs/ sirve la UI de Swagger (HTML) sin CSP que la rompa', async () => {
  const res = await request(app).get('/api-docs/');
  expect(res.status).toBe(200);
  expect(res.text).toMatch(/swagger-ui/i);
  // El CSP por defecto de helmet rompería los estilos/scripts inline de Swagger
  // UI; se desactiva SOLO acá. Regresión: si vuelve el CSP, la UI se rompe.
  expect(res.headers['content-security-policy']).toBeUndefined();
});

test('el CSP estricto de helmet SIGUE activo en el resto de la API', async () => {
  const res = await request(app).get('/health');
  expect(res.headers['content-security-policy']).toBeDefined();
});
