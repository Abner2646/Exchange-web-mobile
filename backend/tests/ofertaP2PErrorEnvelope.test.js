// backend/tests/ofertaP2PErrorEnvelope.test.js
// TDD: verify that createOferta returns the canonical { error: { code, message } }
// envelope for known business failures, and that unexpected throws produce a
// sanitized 500 with no internal-message leak.
// Note: this controller has NO Sequelize transactions, so no rollback assertions needed.

const request = require('supertest');
const express = require('express');

// ── Mocks (declared before any require of the modules they replace) ───────────
jest.mock('../models/index.js', () => ({
  OfertaP2P: {
    getAll: jest.fn(),
    getById: jest.fn(),
    findByPk: jest.fn(),
    createOffer: jest.fn(),
    updateOffer: jest.fn(),
    addMetodosPago: jest.fn(),
    removeMetodosPago: jest.fn(),
    updateStatus: jest.fn(),
    search: jest.fn(),
    getUserOfferHistory: jest.fn(),
    findCompatibleOffers: jest.fn(),
    canAcceptOffer: jest.fn(),
    getStats: jest.fn(),
  },
}));

const { OfertaP2P } = require('../models/index.js');
const asyncHandler = require('../utils/asyncHandler');
const errorHandler = require('../middleware/errorHandler');
const { createOferta } = require('../controllers/ofertaP2P.controller');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal Express app that mounts createOferta, bypassing real auth. */
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-uuid-001', rol: 'usuario' };
    next();
  });
  app.post('/ofertas', asyncHandler(createOferta));
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── createOferta — known business failures ────────────────────────────────────

describe('createOferta — known business error → canonical envelope', () => {

  test('venta without direccionFiat → 400 OFFER_DIRECCION_FIAT_REQUIRED', async () => {
    const res = await request(buildApp())
      .post('/ofertas')
      .send({
        tipo: 'venta',
        metodosPagoIds: ['uuid-metodo-001'],
        // direccionFiat deliberately omitted
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: 'OFFER_DIRECCION_FIAT_REQUIRED',
      },
    });
    expect(res.body.error.message).toBeDefined();
    // Must not expose the raw implementation message
    expect(res.text).not.toContain('obligatoria');
  });

  test('missing metodosPagoIds → 400 OFFER_PAYMENT_METHODS_REQUIRED', async () => {
    const res = await request(buildApp())
      .post('/ofertas')
      .send({
        tipo: 'compra',
        // metodosPagoIds deliberately omitted
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: 'OFFER_PAYMENT_METHODS_REQUIRED',
      },
    });
    expect(res.body.error.message).toBeDefined();
  });

  test('empty metodosPagoIds array → 400 OFFER_PAYMENT_METHODS_REQUIRED', async () => {
    const res = await request(buildApp())
      .post('/ofertas')
      .send({
        tipo: 'compra',
        metodosPagoIds: [],
      });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: {
        code: 'OFFER_PAYMENT_METHODS_REQUIRED',
      },
    });
  });
});

// ── createOferta — unexpected throw ──────────────────────────────────────────

describe('createOferta — unexpected throw → sanitized 500', () => {

  test('DB explosion → sanitized 500, no raw message leak', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    OfertaP2P.createOffer.mockRejectedValue(
      new Error('SECRET: pg connection pool exhausted - host db.internal:5432')
    );

    const res = await request(buildApp())
      .post('/ofertas')
      .send({
        tipo: 'compra',
        metodosPagoIds: ['uuid-metodo-001'],
      });

    // 1. Sanitized 500
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');

    // 2. No internal message leak
    expect(res.text).not.toContain('SECRET');
    expect(res.text).not.toContain('db.internal');
    expect(res.text).not.toContain('pool exhausted');

    // 3. requestId present (central handler adds it to 500s)
    expect(res.body.error.requestId).toBeDefined();

    spy.mockRestore();
  });
});
