// TDD: balanceUsuario.controller debe usar el envelope canónico { error: { code,
// message } } — como los otros 6 controllers money-path — y NUNCA filtrar el
// error.message crudo de un fallo inesperado (guardrail de seguridad). Prueba las
// rutas reales (con asyncHandler) + el errorHandler central.
const request = require('supertest');
const express = require('express');

jest.mock('../models/index.js', () => ({
  BalanceUsuario: {
    getBalancesConCompartimentos: jest.fn(),
    hasAvailableEnCompartimento: jest.fn(),
    updateBalance: jest.fn(),
  },
}));
jest.mock('../services/ledger/operations', () => ({
  transferirInterno: jest.fn(),
  transferirEntreCompartimentos: jest.fn(),
}));
jest.mock('../middleware/authMiddleware.js', () => ({
  authenticateToken: (req, _res, nx) => { req.user = { id: 'user-1' }; nx(); },
}));
jest.mock('../middleware/adminMiddleware.js', () => ({ isAdmin: (_q, _s, n) => n(), isSuperAdmin: (_q, _s, n) => n() }));
jest.mock('../middleware/rateLimit.middleware.js', () => ({ general: (_q, _s, n) => n(), withdrawal: (_q, _s, n) => n() }));
jest.mock('../middleware/idempotency.middleware', () => (_q, _s, n) => n());

const { BalanceUsuario } = require('../models/index.js');
const errorHandler = require('../middleware/errorHandler');
const balanceRoutes = require('../routes/balanceUsuario.routes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/balances', balanceRoutes);
  app.use(errorHandler);
  return app;
}

beforeEach(() => jest.clearAllMocks());

describe('balanceUsuario — canonical error envelope', () => {
  test('unexpected error → sanitized 500, no raw message leak', async () => {
    BalanceUsuario.getBalancesConCompartimentos.mockRejectedValue(
      new Error('SECRET: pg pool exhausted at db.internal:5432')
    );
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(buildApp()).get('/balances/my/balances');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.text).not.toContain('SECRET');
    expect(res.text).not.toContain('db.internal');
    spy.mockRestore();
  });

  test('transfer: missing fields → 400 BALANCE_INVALID_INPUT', async () => {
    const res = await request(buildApp())
      .post('/balances/my/transfer')
      .send({ origen: 'funding', destino: 'spot' }); // falta criptomonedaId + cantidad

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BALANCE_INVALID_INPUT');
  });

  test('transfer: same compartment → 400 BALANCE_INVALID_INPUT', async () => {
    const res = await request(buildApp())
      .post('/balances/my/transfer')
      .send({ criptomonedaId: 'c1', cantidad: '1', origen: 'funding', destino: 'funding' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BALANCE_INVALID_INPUT');
  });

  test('transfer: insufficient (early-check) → 400 BALANCE_INSUFFICIENT', async () => {
    BalanceUsuario.hasAvailableEnCompartimento.mockResolvedValue(false);
    const res = await request(buildApp())
      .post('/balances/my/transfer')
      .send({ criptomonedaId: 'c1', cantidad: '5', origen: 'funding', destino: 'spot' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BALANCE_INSUFFICIENT');
  });

  test('transfer: ledger overdraw (race) → 400 BALANCE_INSUFFICIENT', async () => {
    BalanceUsuario.hasAvailableEnCompartimento.mockResolvedValue(true);
    const sob = new Error('Sobregiro en cuenta funding:disponible');
    sob.code = 'SOBREGIRO';
    const { transferirEntreCompartimentos } = require('../services/ledger/operations');
    transferirEntreCompartimentos.mockRejectedValue(sob);

    const res = await request(buildApp())
      .post('/balances/my/transfer')
      .send({ criptomonedaId: 'c1', cantidad: '5', origen: 'funding', destino: 'spot' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BALANCE_INSUFFICIENT');
  });

  test('updateBalance: missing amount → 400 BALANCE_INVALID_INPUT', async () => {
    const res = await request(buildApp())
      .put('/balances/user/u1/crypto/c1')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BALANCE_INVALID_INPUT');
  });
});
