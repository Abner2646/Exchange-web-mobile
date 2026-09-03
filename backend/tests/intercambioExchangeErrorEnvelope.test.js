// backend/tests/intercambioExchangeErrorEnvelope.test.js
// TDD: verify that createOrder returns the canonical { error: { code, message } }
// envelope for known business failures, and that unexpected throws produce a
// sanitized 500 with no internal-message leak. Also verifies that the Sequelize
// transaction is rolled back on the unexpected path (money-critical).

const request = require('supertest');
const express = require('express');

// ── Mocks (declared before any require of the modules they replace) ──────────
jest.mock('../models/index.js', () => ({
  IntercambioExchange: {
    create: jest.fn(),
    getDailyVolume: jest.fn(),
    getAll: jest.fn(),
    getById: jest.fn(),
    getByUserId: jest.fn(),
    search: jest.fn(),
    getStats: jest.fn(),
    getVolumeByPair: jest.fn(),
    getPriceHistory: jest.fn(),
    getLastPrice: jest.fn(),
    getTopTraders: jest.fn(),
    getMarketSummary: jest.fn(),
    getStatsByCrypto: jest.fn(),
    updateStatus: jest.fn(),
  },
  Usuario: { findByPk: jest.fn() },
  ParExchange: { findByPk: jest.fn() },
  BalanceUsuario: {
    findOne: jest.fn(),
    getSaldoCompartimento: jest.fn(),
    updateBalance: jest.fn(),
  },
  WalletMaestra: {
    findOne: jest.fn(),
    addToBalance: jest.fn(),
  },
  Criptomoneda: {},
  sequelize: {
    transaction: jest.fn(),
  },
}));

// ── Pull in mocked objects so tests can configure them ───────────────────────
const {
  sequelize,
  Usuario,
  ParExchange,
  BalanceUsuario,
  IntercambioExchange,
  WalletMaestra,
} = require('../models/index.js');

const asyncHandler = require('../utils/asyncHandler');
const errorHandler = require('../middleware/errorHandler');
const { createOrder } = require('../controllers/intercambioExchange.controller');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal Express app that mounts createOrder, bypassing auth middleware. */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-uuid-001' };
    next();
  });
  app.post('/intercambioExchange', asyncHandler(createOrder));
  app.use(errorHandler);
  return app;
}

/** Fake Sequelize transaction that records commit/rollback calls. Incluye LOCK
 *  porque createOrder toma un FOR UPDATE sobre la fila de Usuario (límite diario). */
function makeFakeTx() {
  return {
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    LOCK: { UPDATE: 'UPDATE' },
  };
}

const PAR_ID = '123e4567-e89b-12d3-a456-426614174000';

/** Valid pair stub. */
const VALID_PAR = {
  id: PAR_ID,
  activo: true,
  precioActual: '50000',
  comisionPorcentaje: '0.1',
  criptoBaseId: '11111111-1111-1111-1111-111111111111',
  criptoQuoteId: '22222222-2222-2222-2222-222222222222',
  criptoBase: { symbol: 'BTC' },
  criptoQuote: { symbol: 'USDT' },
};

/** Valid request body. */
const VALID_BODY = {
  parId: PAR_ID,
  tipo: 'venta',
  cantidadBase: 0.001,
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ── createOrder — known business failures ────────────────────────────────────

describe('createOrder — known business error → canonical envelope', () => {

  test('insufficient balance (venta) → 400 EXCHANGE_INSUFFICIENT_BALANCE', async () => {
    const tx = makeFakeTx();
    sequelize.transaction.mockResolvedValue(tx);

    ParExchange.findByPk.mockResolvedValue(VALID_PAR);
    Usuario.findByPk.mockResolvedValue({
      id: 'user-uuid-001',
      activo: true,
      limiteDiarioUsd: 99999,
    });
    IntercambioExchange.getDailyVolume.mockResolvedValue(0);
    // Read-flip: el controller lee el saldo via getSaldoCompartimento (Task 9),
    // que devuelve disponible:'0' cuando no hay fondos (insuficiente).
    BalanceUsuario.getSaldoCompartimento.mockResolvedValue({ disponible: '0', bloqueado: '0', pendiente: '0' });

    const res = await request(buildApp())
      .post('/intercambioExchange')
      .send(VALID_BODY);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: 'EXCHANGE_INSUFFICIENT_BALANCE',
      },
    });
    expect(res.body.error.message).toBeDefined();
    // Must not leak raw error internals
    expect(res.text).not.toContain('findOne');
  });

  test('daily limit exceeded → 400 EXCHANGE_DAILY_LIMIT_EXCEEDED', async () => {
    const tx = makeFakeTx();
    sequelize.transaction.mockResolvedValue(tx);

    ParExchange.findByPk.mockResolvedValue(VALID_PAR);
    Usuario.findByPk.mockResolvedValue({
      id: 'user-uuid-001',
      activo: true,
      limiteDiarioUsd: 10, // tiny limit
    });
    // daily volume already at 5, request is 50 => 5+50 > 10
    IntercambioExchange.getDailyVolume.mockResolvedValue(5);

    const res = await request(buildApp())
      .post('/intercambioExchange')
      .send({ ...VALID_BODY, cantidadBase: 0.001 }); // cantidadQuote ~50 USDT

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: 'EXCHANGE_DAILY_LIMIT_EXCEEDED',
      },
    });
  });

  test('pair not found → 404 EXCHANGE_PAIR_NOT_FOUND', async () => {
    const tx = makeFakeTx();
    sequelize.transaction.mockResolvedValue(tx);
    ParExchange.findByPk.mockResolvedValue(null);

    const res = await request(buildApp())
      .post('/intercambioExchange')
      .send(VALID_BODY);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: { code: 'EXCHANGE_PAIR_NOT_FOUND' },
    });
  });

  test('user not found → 404 EXCHANGE_USER_NOT_FOUND', async () => {
    const tx = makeFakeTx();
    sequelize.transaction.mockResolvedValue(tx);
    ParExchange.findByPk.mockResolvedValue(VALID_PAR);
    Usuario.findByPk.mockResolvedValue(null);
    IntercambioExchange.getDailyVolume.mockResolvedValue(0);

    const res = await request(buildApp())
      .post('/intercambioExchange')
      .send(VALID_BODY);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: { code: 'EXCHANGE_USER_NOT_FOUND' },
    });
  });

  test('missing required fields → 400 EXCHANGE_INVALID_INPUT', async () => {
    const tx = makeFakeTx();
    sequelize.transaction.mockResolvedValue(tx);

    const res = await request(buildApp())
      .post('/intercambioExchange')
      .send({ parId: 'par-uuid-001' }); // missing tipo + cantidadBase

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: { code: 'EXCHANGE_INVALID_INPUT' },
    });
  });
});

// ── createOrder — unexpected throw ────────────────────────────────────────────

describe('createOrder — unexpected throw → sanitized 500 + rollback preserved', () => {

  test('DB explosion → sanitized 500, no raw message leak, rollback called', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const tx = makeFakeTx();
    sequelize.transaction.mockResolvedValue(tx);

    // Simulate an unexpected DB error after the transaction is opened
    ParExchange.findByPk.mockRejectedValue(
      new Error('SECRET: pg connection pool exhausted - host db.internal:5432')
    );

    const res = await request(buildApp())
      .post('/intercambioExchange')
      .send(VALID_BODY);

    // 1. Sanitized 500
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');

    // 2. No internal message leak
    expect(res.text).not.toContain('SECRET');
    expect(res.text).not.toContain('db.internal');
    expect(res.text).not.toContain('pool exhausted');

    // 3. Rollback was called (money-critical)
    expect(tx.rollback).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});
