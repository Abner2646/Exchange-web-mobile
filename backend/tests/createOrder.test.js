// tests/createOrder.test.js
//
// Cubre AUDITORIA_BACKEND.md Críticos #4 y #6: createOrder tenía "type"
// hardcodeado a sell (una buy debitaba y acreditaba al revés de lo
// pedido) y el límite diario estaba deshabilitado. También cubre Altos #3
// (req.usuario vs req.user) en checkTransactionLimit.
//
// Los modelos de Sequelize se mockean por completo: lo que se está
// probando es la lógica de negocio del controller (qué balance se debita,
// cuál se acredita, en qué signo), no la capa de persistencia — eso es
// trabajo de un test de integración con DB real (Fase 2 del roadmap).
//
// NOTE (refactor 2026-08-24): createOrder and checkTransactionLimit now throw
// AppError instead of calling res.status().json() for business failures. Tests
// that invoked the handler directly and expected the old res-based response
// have been migrated to use the HTTP layer (supertest + asyncHandler +
// errorHandler) while preserving the same business-behavior assertion.
//
// NOTE (money.js migration 2026-08-24): the settlement arithmetic moved out of
// the controller (float parseFloat/Number) into intercambioSettlement.service
// (exact, money.js). The deltas passed to updateBalance/addToBalance are now
// canonical strings ('-101', '1', ...) instead of Numbers — same boundary
// change already applied across the money-movement path.

const request = require('supertest');
const express = require('express');

jest.mock('../models/index.js', () => ({
  Swap: { create: jest.fn(), getDailyVolume: jest.fn() },
  User: { findByPk: jest.fn() },
  SwapPair: { findByPk: jest.fn() },
  UserBalance: { getCompartmentBalance: jest.fn() },
  Crypto: {},
  sequelize: { transaction: jest.fn() },
}));

// Paso D: el swap liquida en el ledger vía settleSwap (usuario↔treasury,
// comisión→fee_revenue). El unit test mockea esa operación de dominio y asevera
// la delegación; el resultado real en el ledger lo cubre el test de integración.
jest.mock('../modules/balances/ledger/operations', () => ({ settleSwap: jest.fn() }));

const {
  Swap,
  User,
  SwapPair,
  UserBalance,
  sequelize,
} = require('../models/index.js');
const { settleSwap } = require('../modules/balances/ledger/operations');

const asyncHandler = require('../utils/asyncHandler');
const errorHandler = require('../middleware/errorHandler');
const { createOrder, checkTransactionLimit } = require('../modules/swap/swap.controller');

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

/** Build a minimal app that routes POST / to createOrder via asyncHandler. */
function buildCreateOrderApp(userId = USER_ID) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: userId }; next(); });
  app.post('/', asyncHandler(createOrder));
  app.use(errorHandler);
  return app;
}

/** Build a minimal app that routes POST /check-limit to checkTransactionLimit. */
function buildCheckLimitApp(userId = USER_ID) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: userId }; next(); });
  app.post('/check-limit', asyncHandler(checkTransactionLimit));
  app.use(errorHandler);
  return app;
}

const CRIPTO_BASE_ID = 'base-crypto-id';
const CRIPTO_QUOTE_ID = 'quote-crypto-id';
const PAR_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-1';

function setupCommonMocks({ dailyLimitUsd = 1000000, dailyVolume = 0 } = {}) {
  // LOCK: createOrder toma un FOR UPDATE sobre la fila de User (límite diario).
  const transaction = { commit: jest.fn(), rollback: jest.fn(), LOCK: { UPDATE: 'UPDATE' } };
  sequelize.transaction.mockResolvedValue(transaction);

  SwapPair.findByPk.mockResolvedValue({
    active: true,
    currentPrice: '100',
    feePercent: 1, // 1%
    baseCryptoId: CRIPTO_BASE_ID,
    quoteCryptoId: CRIPTO_QUOTE_ID,
    baseCrypto: { symbol: 'BTC' },
    quoteCrypto: { symbol: 'USDT' },
  });

  User.findByPk.mockResolvedValue({ active: true, dailyLimitUsd });
  Swap.getDailyVolume.mockResolvedValue(dailyVolume);
  Swap.create.mockImplementation(async (data) => ({
    ...data,
    id: 'order-1',
    toJSON: () => data,
  }));

  return transaction;
}

describe('createOrder', () => {
  beforeEach(() => jest.clearAllMocks());

  test('type "buy" debita quote y acredita base (no al revés)', async () => {
    setupCommonMocks();
    // Balance quote suficiente para pagar 1 BTC * 100 + 1% comisión = 101
    UserBalance.getCompartmentBalance.mockResolvedValue({ available: '200', blocked: '0', pending: '0' });

    const req = { user: { id: USER_ID }, body: { pairId: PAR_ID, type: 'buy', baseAmount: 1 } };
    const res = mockRes();

    await createOrder(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.type).toBe('buy');

    // Comprar: settleSwap recibe requiredQuote (valor+comisión) en quote y
    // baseAmount en base — la dirección correcta del swap.
    expect(settleSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        quoteCryptoId: CRIPTO_QUOTE_ID,
        baseCryptoId: CRIPTO_BASE_ID,
        type: 'buy',
        quoteAmount: '100',
        feeAmount: '1',
        requiredQuote: '101',
        compartimento: 'funding',
      }),
      expect.anything()
    );
  });

  test('type "sell" debita base y acredita quote', async () => {
    setupCommonMocks();
    UserBalance.getCompartmentBalance.mockResolvedValue({ available: '200', blocked: '0', pending: '0' });

    const req = { user: { id: USER_ID }, body: { pairId: PAR_ID, type: 'sell', baseAmount: 1 } };
    const res = mockRes();

    await createOrder(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.type).toBe('sell');

    // Vender: settleSwap recibe baseAmount en base y netQuote (valor−comisión)
    // en quote.
    expect(settleSwap).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        baseCryptoId: CRIPTO_BASE_ID,
        quoteCryptoId: CRIPTO_QUOTE_ID,
        type: 'sell',
        quoteAmount: '100',
        feeAmount: '1',
        netQuote: '99',
        compartimento: 'funding',
      }),
      expect.anything()
    );
  });

  test('la liquidación (incluida la comisión → fee_revenue) corre en la transacción de la orden', async () => {
    const transaction = setupCommonMocks();
    UserBalance.getCompartmentBalance.mockResolvedValue({ available: '200', blocked: '0', pending: '0' });

    const req = { user: { id: USER_ID }, body: { pairId: PAR_ID, type: 'sell', baseAmount: 1 } };
    await createOrder(req, mockRes());

    expect(settleSwap).toHaveBeenCalledWith(
      expect.objectContaining({ feeAmount: '1', type: 'sell' }),
      transaction
    );
  });

  test('rechaza la orden si supera el límite diario (chequeo ya no está deshabilitado)', async () => {
    // Migrated to HTTP layer: createOrder now throws AppError for business
    // failures so the assertion must go through asyncHandler + errorHandler.
    setupCommonMocks({ dailyLimitUsd: 50, dailyVolume: 0 });
    UserBalance.getCompartmentBalance.mockResolvedValue({ available: '200', blocked: '0', pending: '0' });

    // quoteAmount = 1 * 100 = 100, supera el límite de 50
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(buildCreateOrderApp())
      .post('/')
      .send({ pairId: PAR_ID, type: 'sell', baseAmount: 1 });
    spy.mockRestore();

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXCHANGE_DAILY_LIMIT_EXCEEDED');
    expect(settleSwap).not.toHaveBeenCalled();
  });
});

describe('checkTransactionLimit', () => {
  beforeEach(() => jest.clearAllMocks());

  test('usa req.user.id (no req.usuario.id) y no revienta', async () => {
    Swap.getDailyVolume.mockResolvedValue(0);
    User.findByPk.mockResolvedValue({ dailyLimitUsd: 1000 });

    const req = { user: { id: USER_ID }, body: { quoteAmount: 100 } };
    const res = mockRes();

    await checkTransactionLimit(req, res);

    expect(res.statusCode).toBeNull(); // res.json() sin status() previo = 200 implícito
    expect(res.body.canTransact).toBe(true);
  });

  test('devuelve 400 EXCHANGE_DAILY_LIMIT_EXCEEDED cuando se supera el límite', async () => {
    // Migrated to HTTP layer: checkTransactionLimit now throws AppError instead
    // of responding directly. The canTransact:false field has been replaced by
    // the canonical error envelope in the 400 response.
    Swap.getDailyVolume.mockResolvedValue(950);
    User.findByPk.mockResolvedValue({ dailyLimitUsd: 1000 });

    const res = await request(buildCheckLimitApp())
      .post('/check-limit')
      .send({ quoteAmount: 100 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXCHANGE_DAILY_LIMIT_EXCEEDED');
  });
});
