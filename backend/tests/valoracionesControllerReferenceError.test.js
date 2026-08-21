// tests/valoracionesControllerReferenceError.test.js
//
// Cubre AUDITORIA_BACKEND.md Altos #11 (parte del hallazgo "Código muerto
// #4" original, que en realidad afecta al sistema de valoraciones ya
// activo, no a un controller huérfano): getTopRatedUsers y
// getUsersRatingSummary usaban Op y sequelize sin importarlos.

jest.mock('../models/index.js', () => ({
  Valoracion: { findAll: jest.fn().mockResolvedValue([]) },
  Usuario: { findAll: jest.fn().mockResolvedValue([]) },
  sequelize: {
    fn: jest.fn(() => 'FN'),
    col: jest.fn(() => 'COL'),
    where: jest.fn(() => 'WHERE'),
  },
}));

const { getTopRatedUsers, getUsersRatingSummary } = require('../controllers/valoraciones.controller');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('getTopRatedUsers responde sin ReferenceError (Op/sequelize ahora están importados)', async () => {
  const req = { query: {} };
  const res = mockRes();

  await getTopRatedUsers(req, res);

  // Si Op/sequelize siguieran sin definirse, esto sería 500 con
  // "Op is not defined" / "sequelize is not defined" en el body.
  expect(res.statusCode).not.toBe(500);
});

test('getUsersRatingSummary responde sin ReferenceError', async () => {
  const req = { params: { usuario1Id: 'a', usuario2Id: 'b' } };
  const res = mockRes();

  await getUsersRatingSummary(req, res);

  expect(res.statusCode).not.toBe(500);
});
