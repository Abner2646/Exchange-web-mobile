// tests/createOrder.test.js
//
// Cubre AUDITORIA_BACKEND.md Críticos #4 y #6: createOrder tenía "tipo"
// hardcodeado a venta (una compra debitaba y acreditaba al revés de lo
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
  IntercambioExchange: { create: jest.fn(), getDailyVolume: jest.fn() },
  Usuario: { findByPk: jest.fn() },
  ParExchange: { findByPk: jest.fn() },
  BalanceUsuario: { findOne: jest.fn(), updateBalance: jest.fn() },
  WalletMaestra: { findOne: jest.fn(), addToBalance: jest.fn() },
  Criptomoneda: {},
  sequelize: { transaction: jest.fn() },
}));

const {
  IntercambioExchange,
  Usuario,
  ParExchange,
  BalanceUsuario,
  WalletMaestra,
  sequelize,
} = require('../models/index.js');

const asyncHandler = require('../utils/asyncHandler');
const errorHandler = require('../middleware/errorHandler');
const { createOrder, checkTransactionLimit } = require('../controllers/intercambioExchange.controller');

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

function setupCommonMocks({ limiteDiarioUsd = 1000000, dailyVolume = 0 } = {}) {
  const transaction = { commit: jest.fn(), rollback: jest.fn() };
  sequelize.transaction.mockResolvedValue(transaction);

  ParExchange.findByPk.mockResolvedValue({
    activo: true,
    precioActual: '100',
    comisionPorcentaje: 1, // 1%
    criptoBaseId: CRIPTO_BASE_ID,
    criptoQuoteId: CRIPTO_QUOTE_ID,
    criptoBase: { symbol: 'BTC' },
    criptoQuote: { symbol: 'USDT' },
  });

  Usuario.findByPk.mockResolvedValue({ activo: true, limiteDiarioUsd });
  IntercambioExchange.getDailyVolume.mockResolvedValue(dailyVolume);
  IntercambioExchange.create.mockImplementation(async (data) => ({
    ...data,
    toJSON: () => data,
  }));
  WalletMaestra.findOne.mockResolvedValue({ id: 'wallet-maestra-quote' });

  return transaction;
}

describe('createOrder', () => {
  beforeEach(() => jest.clearAllMocks());

  test('tipo "compra" debita quote y acredita base (no al revés)', async () => {
    setupCommonMocks();
    // Balance quote suficiente para pagar 1 BTC * 100 + 1% comisión = 101
    BalanceUsuario.findOne.mockResolvedValue({ balanceDisponible: '200' });

    const req = { user: { id: USER_ID }, body: { parId: PAR_ID, tipo: 'compra', cantidadBase: 1 } };
    const res = mockRes();

    await createOrder(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.tipo).toBe('compra');

    // Débito en quote (negativo) y crédito en base (positivo) — exactamente
    // lo que "comprar" tiene que hacer.
    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith(
      USER_ID, CRIPTO_QUOTE_ID, '-101', 'disponible', expect.anything()
    );
    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith(
      USER_ID, CRIPTO_BASE_ID, '1', 'disponible', expect.anything()
    );
  });

  test('tipo "venta" debita base y acredita quote', async () => {
    setupCommonMocks();
    BalanceUsuario.findOne.mockResolvedValue({ balanceDisponible: '200' });

    const req = { user: { id: USER_ID }, body: { parId: PAR_ID, tipo: 'venta', cantidadBase: 1 } };
    const res = mockRes();

    await createOrder(req, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.data.tipo).toBe('venta');

    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith(
      USER_ID, CRIPTO_BASE_ID, '-1', 'disponible', expect.anything()
    );
    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith(
      USER_ID, CRIPTO_QUOTE_ID, '99', 'disponible', expect.anything()
    );
  });

  test('la comisión se acredita en la misma transacción de la orden', async () => {
    const transaction = setupCommonMocks();
    BalanceUsuario.findOne.mockResolvedValue({ balanceDisponible: '200' });

    const req = { user: { id: USER_ID }, body: { parId: PAR_ID, tipo: 'venta', cantidadBase: 1 } };
    await createOrder(req, mockRes());

    expect(WalletMaestra.addToBalance).toHaveBeenCalledWith('wallet-maestra-quote', '1', transaction);
  });

  test('rechaza la orden si supera el límite diario (chequeo ya no está deshabilitado)', async () => {
    // Migrated to HTTP layer: createOrder now throws AppError for business
    // failures so the assertion must go through asyncHandler + errorHandler.
    setupCommonMocks({ limiteDiarioUsd: 50, dailyVolume: 0 });
    BalanceUsuario.findOne.mockResolvedValue({ balanceDisponible: '200' });

    // cantidadQuote = 1 * 100 = 100, supera el límite de 50
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(buildCreateOrderApp())
      .post('/')
      .send({ parId: PAR_ID, tipo: 'venta', cantidadBase: 1 });
    spy.mockRestore();

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXCHANGE_DAILY_LIMIT_EXCEEDED');
    expect(BalanceUsuario.updateBalance).not.toHaveBeenCalled();
  });
});

describe('checkTransactionLimit', () => {
  beforeEach(() => jest.clearAllMocks());

  test('usa req.user.id (no req.usuario.id) y no revienta', async () => {
    IntercambioExchange.getDailyVolume.mockResolvedValue(0);
    Usuario.findByPk.mockResolvedValue({ limiteDiarioUsd: 1000 });

    const req = { user: { id: USER_ID }, body: { cantidadQuote: 100 } };
    const res = mockRes();

    await checkTransactionLimit(req, res);

    expect(res.statusCode).toBeNull(); // res.json() sin status() previo = 200 implícito
    expect(res.body.canTransact).toBe(true);
  });

  test('devuelve 400 EXCHANGE_DAILY_LIMIT_EXCEEDED cuando se supera el límite', async () => {
    // Migrated to HTTP layer: checkTransactionLimit now throws AppError instead
    // of responding directly. The canTransact:false field has been replaced by
    // the canonical error envelope in the 400 response.
    IntercambioExchange.getDailyVolume.mockResolvedValue(950);
    Usuario.findByPk.mockResolvedValue({ limiteDiarioUsd: 1000 });

    const res = await request(buildCheckLimitApp())
      .post('/check-limit')
      .send({ cantidadQuote: 100 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXCHANGE_DAILY_LIMIT_EXCEEDED');
  });
});
