// backend/tests/transferenciaErrorEnvelope.test.js
// TDD: verify that createTransferencia and procesarTransferencia return the
// canonical { error: { code, message } } envelope for known business failures,
// and that unexpected DB throws produce a sanitized 500 (no raw message leak).

const request = require('supertest');
const express = require('express');

// ── Mocks (declared before any require of the modules they replace) ──────────
jest.mock('../models/index.js', () => ({
  Transferencia: {
    create: jest.fn(),
    findByPk: jest.fn(),
    getById: jest.fn(),
    getByUsuario: jest.fn(),
    getAll: jest.fn(),
    getStats: jest.fn(),
    cancelarTransferencia: jest.fn(),
    reenviarCodigo: jest.fn(),
  },
  Usuario: { findByPk: jest.fn() },
  Criptomoneda: { findByPk: jest.fn(), getById: jest.fn() },
  BalanceUsuario: {
    hasAvailableBalance: jest.fn(),
    findOne: jest.fn(),
    updateBalance: jest.fn(),
    getByUserAndCrypto: jest.fn(),
  },
  Notificaciones: { createNotification: jest.fn() },
  sequelize: {
    transaction: jest.fn(),
  },
}));

jest.mock('../services/email.service.js', () => ({
  enviarCodigoTransferencia: jest.fn().mockResolvedValue(undefined),
  notificarTransferenciaCompletada: jest.fn().mockResolvedValue(undefined),
}));

// ── Pull in the mocked objects so tests can configure them ──────────────────
const { sequelize, Usuario, Criptomoneda, BalanceUsuario, Transferencia } =
  require('../models/index.js');

const asyncHandler = require('../utils/asyncHandler');
const errorHandler = require('../middleware/errorHandler');
const {
  createTransferencia,
  procesarTransferencia,
} = require('../controllers/transferencia.controller');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal Express app that mounts a single handler under the given
 * method + path, then attaches the central error handler.  We bypass all
 * auth/idempotency middleware — we only care about the controller logic.
 */
function buildApp(method, path, handler) {
  const app = express();
  app.use(express.json());
  // Inject a fake authenticated user
  app.use((req, _res, next) => {
    req.user = { id: 'user-sender-id', rol: 'normal' };
    next();
  });
  app[method](path, asyncHandler(handler));
  app.use(errorHandler);
  return app;
}

/** Fake Sequelize transaction that records calls. */
function makeFakeTx() {
  return { commit: jest.fn(), rollback: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── createTransferencia ──────────────────────────────────────────────────────

describe('createTransferencia', () => {
  const app = () => buildApp('post', '/transfers', createTransferencia);

  const validBody = {
    usuarioDestinatarioId: 'dest-id',
    criptomonedaId: 'crypto-id',
    cantidad: '0.5',
    concepto: 'test',
  };

  test('insufficient balance → 400 INSUFFICIENT_FUNDS (canonical envelope)', async () => {
    const tx = makeFakeTx();
    sequelize.transaction.mockResolvedValue(tx);

    Usuario.findByPk.mockResolvedValue({ id: 'dest-id', activo: true, username: 'dest' });
    Criptomoneda.findByPk.mockResolvedValue({ id: 'crypto-id', activa: true, symbol: 'BTC' });
    BalanceUsuario.hasAvailableBalance.mockResolvedValue(false);

    const res = await request(app()).post('/transfers').send(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Fondos insuficientes para realizar la transferencia',
      },
    });
  });

  test('unexpected DB throw → sanitized 500, no raw message in body', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const tx = makeFakeTx();
    sequelize.transaction.mockResolvedValue(tx);
    Usuario.findByPk.mockRejectedValue(new Error('SECRET: DB connection string'));

    const res = await request(app()).post('/transfers').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.text).not.toContain('SECRET');
    expect(res.text).not.toContain('DB connection string');
    spy.mockRestore();
  });
});

// ── procesarTransferencia ────────────────────────────────────────────────────

describe('procesarTransferencia', () => {
  const app = () => buildApp('post', '/transfers/:id/process', procesarTransferencia);

  test('transfer not found → 404 TRANSFER_NOT_FOUND (canonical envelope)', async () => {
    const tx = makeFakeTx();
    sequelize.transaction.mockResolvedValue(tx);
    Transferencia.findByPk.mockResolvedValue(null);

    const res = await request(app())
      .post('/transfers/nonexistent-id/process')
      .send({ codigoVerificacion: '123456' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'TRANSFER_NOT_FOUND',
        message: 'Transferencia no encontrada',
      },
    });
  });

  test('wrong owner → 403 TRANSFER_FORBIDDEN (canonical envelope)', async () => {
    const tx = makeFakeTx();
    sequelize.transaction.mockResolvedValue(tx);
    Transferencia.findByPk.mockResolvedValue({
      id: 'tx-id',
      usuarioRemitenteId: 'someone-else-id', // not 'user-sender-id'
      estado: 'pendiente',
      codigoVerificacion: '123456',
      expiracionCodigo: new Date(Date.now() + 999999),
    });

    const res = await request(app())
      .post('/transfers/tx-id/process')
      .send({ codigoVerificacion: '123456' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: {
        code: 'TRANSFER_FORBIDDEN',
        message: 'No tienes permiso para procesar esta transferencia',
      },
    });
  });

  test('invalid verification code → 400 VERIFICATION_CODE_INVALID (canonical envelope)', async () => {
    const tx = makeFakeTx();
    sequelize.transaction.mockResolvedValue(tx);
    Transferencia.findByPk.mockResolvedValue({
      id: 'tx-id',
      usuarioRemitenteId: 'user-sender-id',
      estado: 'pendiente',
      codigoVerificacion: '999999',
      expiracionCodigo: new Date(Date.now() + 999999),
    });

    const res = await request(app())
      .post('/transfers/tx-id/process')
      .send({ codigoVerificacion: '111111' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VERIFICATION_CODE_INVALID',
        message: 'Código de verificación incorrecto',
      },
    });
  });

  test('expired verification code → 400 VERIFICATION_CODE_EXPIRED (canonical envelope)', async () => {
    const tx = makeFakeTx();
    sequelize.transaction.mockResolvedValue(tx);
    Transferencia.findByPk.mockResolvedValue({
      id: 'tx-id',
      usuarioRemitenteId: 'user-sender-id',
      estado: 'pendiente',
      codigoVerificacion: '123456',
      expiracionCodigo: new Date(Date.now() - 1000), // in the past
    });

    const res = await request(app())
      .post('/transfers/tx-id/process')
      .send({ codigoVerificacion: '123456' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VERIFICATION_CODE_EXPIRED',
        message: 'El código de verificación ha expirado',
      },
    });
  });
});
