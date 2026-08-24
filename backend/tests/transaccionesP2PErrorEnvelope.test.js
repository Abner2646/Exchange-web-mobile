// backend/tests/transaccionesP2PErrorEnvelope.test.js
// TDD: verify that the P2P transaction controller returns the canonical
// { error: { code, message } } envelope for known business failures, and that
// unexpected throws produce a sanitized 500 with no internal-message leak.
//
// Transaction/rollback notes (per handler):
//   - createTransaccion: calls TransaccionP2P.createTransaction, which opens and
//     manages the Sequelize transaction entirely inside the MODEL. The controller
//     has no direct transaction reference — no rollback to assert in the controller.
//   - confirmPayment / completeTransaction / cancelTransaction: same pattern —
//     model methods own the transaction; controller only calls the method.
//   - forceStatusChange: controller calls TransaccionP2P.findByPk + .update
//     (plain Sequelize instance methods, no explicit transaction opened in the
//     controller) — no rollback to assert in the controller.
//   - All other handlers (getTransacciones, getTransaccionById, getMyTransacciones,
//     getPendingTransacciones, getTransaccionesStats, getUserVolume, checkTimeouts,
//     getTransaccionesByOferta, getTransactionHistory): read-only or delegate to
//     model helpers — no controller-level transaction.

const request = require('supertest');
const express = require('express');

// ── Mocks (declared before any require of the modules they replace) ────────────
jest.mock('../models/index.js', () => ({
  TransaccionP2P: {
    getAll: jest.fn(),
    getById: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
    createTransaction: jest.fn(),
    confirmPayment: jest.fn(),
    completeTransaction: jest.fn(),
    cancelTransaction: jest.fn(),
    getPendingTransactions: jest.fn(),
    getStats: jest.fn(),
    getUserVolume: jest.fn(),
    checkTimeouts: jest.fn(),
  },
  Criptomoneda: {},
  Usuario: {},
  OfertaP2P: {
    findByPk: jest.fn(),
  },
}));

const { TransaccionP2P, OfertaP2P } = require('../models/index.js');
const asyncHandler = require('../utils/asyncHandler');
const errorHandler = require('../middleware/errorHandler');
const controller = require('../controllers/transaccionesP2P.controller');

// ── App builders ──────────────────────────────────────────────────────────────

/** Mount createTransaccion as POST /transacciones */
function buildCreateApp({ userId = 'user-uuid-001', rol = 'usuario' } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, rol };
    next();
  });
  app.post('/transacciones', asyncHandler(controller.createTransaccion));
  app.use(errorHandler);
  return app;
}

/** Mount getTransaccionById as GET /transacciones/:id */
function buildGetByIdApp({ userId = 'user-uuid-001', rol = 'usuario' } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, rol };
    next();
  });
  app.get('/transacciones/:id', asyncHandler(controller.getTransaccionById));
  app.use(errorHandler);
  return app;
}

/** Mount forceStatusChange as PATCH /transacciones/:id/force-status */
function buildForceStatusApp({ userId = 'admin-uuid-001', rol = 'admin' } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, rol };
    next();
  });
  app.patch('/transacciones/:id/force-status', asyncHandler(controller.forceStatusChange));
  app.use(errorHandler);
  return app;
}

/** Mount getUserVolume as GET /transacciones/volume */
function buildGetVolumeApp({ userId = 'user-uuid-001', rol = 'usuario' } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: userId, rol };
    next();
  });
  // Simulate the admin variant that accepts a :usuarioId param
  app.get('/transacciones/volume/:usuarioId', asyncHandler(controller.getUserVolume));
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── createTransaccion — known business failures ───────────────────────────────

describe('createTransaccion — known business error → canonical envelope', () => {
  test('offer not found → 404 P2P_TX_OFFER_NOT_FOUND', async () => {
    OfertaP2P.findByPk.mockResolvedValue(null);

    const res = await request(buildCreateApp())
      .post('/transacciones')
      .send({ ofertaId: 'offer-uuid-404', cantidad: 1, metodoPagoId: 'mp-001' });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: { code: 'P2P_TX_OFFER_NOT_FOUND' },
    });
    expect(res.body.error.message).toBeDefined();
    // Must NOT leak raw error.message
    expect(res.text).not.toContain('Oferta no encontrada');
  });

  test('user accepting own offer → 400 P2P_TX_OWN_OFFER', async () => {
    OfertaP2P.findByPk.mockResolvedValue({
      usuarioId: 'user-uuid-001', // same as req.user.id
      tipo: 'venta',
      criptomonedaId: 'crypto-001',
      precioUnitario: 100,
    });

    const res = await request(buildCreateApp({ userId: 'user-uuid-001' }))
      .post('/transacciones')
      .send({ ofertaId: 'offer-uuid-001', cantidad: 1, metodoPagoId: 'mp-001' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: { code: 'P2P_TX_OWN_OFFER' },
    });
    expect(res.body.error.message).toBeDefined();
    expect(res.text).not.toContain('propia oferta');
  });
});

// ── createTransaccion — unexpected throw ─────────────────────────────────────

describe('createTransaccion — unexpected throw → sanitized 500', () => {
  test('DB explosion → sanitized 500, no raw message leak', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    OfertaP2P.findByPk.mockResolvedValue({
      usuarioId: 'seller-uuid-999',
      tipo: 'venta',
      criptomonedaId: 'crypto-001',
      precioUnitario: 100,
    });
    TransaccionP2P.createTransaction.mockRejectedValue(
      new Error('SECRET: pg connection pool exhausted - host db.internal:5432')
    );

    const res = await request(buildCreateApp({ userId: 'buyer-uuid-001' }))
      .post('/transacciones')
      .send({ ofertaId: 'offer-uuid-001', cantidad: 1, metodoPagoId: 'mp-001' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    // No internal message leak
    expect(res.text).not.toContain('SECRET');
    expect(res.text).not.toContain('db.internal');
    expect(res.text).not.toContain('pool exhausted');
    // requestId present
    expect(res.body.error.requestId).toBeDefined();

    spy.mockRestore();
  });
});

// ── getTransaccionById — known business failures ──────────────────────────────

describe('getTransaccionById — known business error → canonical envelope', () => {
  test('transaction not found → 404 P2P_TX_NOT_FOUND', async () => {
    TransaccionP2P.getById.mockResolvedValue(null);

    const res = await request(buildGetByIdApp())
      .get('/transacciones/nonexistent-id');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: { code: 'P2P_TX_NOT_FOUND' },
    });
    expect(res.body.error.message).toBeDefined();
    expect(res.text).not.toContain('Transacción no encontrada');
  });

  test('user accessing other user transaction → 403 P2P_TX_FORBIDDEN', async () => {
    TransaccionP2P.getById.mockResolvedValue({
      compradorId: 'other-user-001',
      vendedorId: 'other-user-002',
    });

    const res = await request(buildGetByIdApp({ userId: 'intruder-uuid', rol: 'usuario' }))
      .get('/transacciones/some-tx-id');

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: { code: 'P2P_TX_FORBIDDEN' },
    });
    expect(res.body.error.message).toBeDefined();
    expect(res.text).not.toContain('permiso');
  });
});

// ── forceStatusChange — known business failures ───────────────────────────────

describe('forceStatusChange — known business error → canonical envelope', () => {
  test('non-admin user → 403 P2P_TX_ADMIN_REQUIRED', async () => {
    const res = await request(buildForceStatusApp({ userId: 'regular-user', rol: 'usuario' }))
      .patch('/transacciones/some-id/force-status')
      .send({ estado: 'completada', motivo: 'manual fix' });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: { code: 'P2P_TX_ADMIN_REQUIRED' },
    });
    expect(res.body.error.message).toBeDefined();
    expect(res.text).not.toContain('administradores');
  });

  test('transaction not found (admin) → 404 P2P_TX_NOT_FOUND', async () => {
    TransaccionP2P.findByPk.mockResolvedValue(null);

    const res = await request(buildForceStatusApp({ userId: 'admin-uuid', rol: 'admin' }))
      .patch('/transacciones/nonexistent-id/force-status')
      .send({ estado: 'completada', motivo: 'manual fix' });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      error: { code: 'P2P_TX_NOT_FOUND' },
    });
    expect(res.body.error.message).toBeDefined();
    expect(res.text).not.toContain('Transacción no encontrada');
  });
});

// ── getUserVolume — known business failure ────────────────────────────────────

describe('getUserVolume — known business error → canonical envelope', () => {
  test('non-admin accessing another user volume → 403 P2P_TX_FORBIDDEN', async () => {
    const res = await request(buildGetVolumeApp({ userId: 'user-A', rol: 'usuario' }))
      .get('/transacciones/volume/user-B'); // different userId

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({
      error: { code: 'P2P_TX_FORBIDDEN' },
    });
    expect(res.body.error.message).toBeDefined();
    expect(res.text).not.toContain('permiso');
  });
});
