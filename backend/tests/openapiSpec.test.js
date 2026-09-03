// Unit sin-DB: el spec OpenAPI se genera desde las anotaciones @openapi de los
// route files (swagger-jsdoc). Este test es la barrera de regresión: si alguien
// rompe la config o borra las anotaciones de un money-path, se cae acá.
const spec = require('../config/swagger');

test('es un doc OpenAPI 3 con info + esquema de seguridad JWT + envelope de error', () => {
  expect(spec.openapi).toMatch(/^3\./);
  expect(spec.info.title).toBeTruthy();
  expect(spec.info.version).toBeTruthy();
  expect(spec.components.securitySchemes.bearerAuth).toMatchObject({ type: 'http', scheme: 'bearer' });
  // El envelope canónico { error: { code, message } } documentado una sola vez.
  expect(spec.components.schemas.ErrorEnvelope).toBeDefined();
});

test('documenta los endpoints money-path de balances (anotaciones tomadas)', () => {
  expect(spec.paths['/balances/my/balances']).toBeDefined();
  expect(spec.paths['/balances/my/balances'].get).toBeDefined();
  expect(spec.paths['/balances/my/transfer'].post).toBeDefined();
});
