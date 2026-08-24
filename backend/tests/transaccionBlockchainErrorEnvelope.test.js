// backend/tests/transaccionBlockchainErrorEnvelope.test.js
//
// TDD: verify that the transaccionBlockchain controller returns the canonical
// { error: { code, message } } envelope for known business failures, and that
// unexpected service throws produce a sanitized 500 (no raw message leak).
//
// We mount the real /withdraw and /deposit-address/:id routes with their
// middleware stack + errorHandler, bypassing auth (injected via fake middleware).

const request = require('supertest');
const express = require('express');

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../models', () => ({
  TransaccionBlockchain: {
    getByUser: jest.fn(),
    getById: jest.fn(),
    getByTxHash: jest.fn(),
    validateWithdrawal: jest.fn(),
    createWithdrawal: jest.fn(),
    findByPk: jest.fn(),
    update: jest.fn(),
    getAllWithFilters: jest.fn(),
    getPendingDeposits: jest.fn(),
    getPendingWithdrawals: jest.fn(),
    getStats: jest.fn(),
    failWithdrawal: jest.fn(),
  },
  Usuario: { findByPk: jest.fn() },
  Criptomoneda: { findByPk: jest.fn() },
  BalanceUsuario: { findAll: jest.fn() },
  DireccionDeposito: {
    getByUserAndCrypto: jest.fn(),
    generateAddressForUser: jest.fn(),
  },
}));

jest.mock('../services/blockchain', () => ({
  getService: jest.fn(),
}));

jest.mock('../jobs/blockchain.jobs', () => ({
  runDepositScanJob: jest.fn(),
  runWithdrawalProcessJob: jest.fn(),
  runConfirmationUpdateJob: jest.fn(),
}));

// Idempotency middleware: bypass it entirely for these envelope tests —
// we just want to verify controller-level error responses.
jest.mock('../middleware/idempotency.middleware', () => (req, res, next) => next());

const { TransaccionBlockchain, Criptomoneda, DireccionDeposito } = require('../models');
const BlockchainServiceManager = require('../services/blockchain');

const asyncHandler = require('../utils/asyncHandler');
const errorHandler = require('../middleware/errorHandler');
const controller = require('../controllers/transaccionBlockchain.controller');

// ── App builders ──────────────────────────────────────────────────────────────

/**
 * Mount a single controller method (bound-safe via controller object) under a
 * route, preceded by a fake auth injector, followed by the central error handler.
 */
function buildApp(method, path, handler) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-test-id', rol: 'usuario' };
    next();
  });
  app[method](path, asyncHandler(handler.bind(controller)));
  app.use(errorHandler);
  return app;
}

/**
 * Build the /withdraw route with its full middleware chain, minus real auth/rate-limit.
 * idempotency is mocked above to just call next().
 */
function buildWithdrawApp() {
  const joiValidate = require('../middleware/joiValidate.middleware').joiValidate;
  const schema = require('../schemas/transaccionBlockchain.schema');
  const idempotency = require('../middleware/idempotency.middleware');

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-test-id', rol: 'usuario' };
    next();
  });
  app.post(
    '/withdraw',
    joiValidate(schema.createWithdrawal),
    idempotency,
    asyncHandler(controller.createWithdrawal.bind(controller))
  );
  app.use(errorHandler);
  return app;
}

function buildDepositAddressApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-test-id', rol: 'usuario' };
    next();
  });
  app.get(
    '/deposit-address/:criptomonedaId',
    asyncHandler(controller.getDepositAddress.bind(controller))
  );
  app.use(errorHandler);
  return app;
}

beforeEach(() => jest.clearAllMocks());

// ── /withdraw ─────────────────────────────────────────────────────────────────

describe('POST /withdraw — business error paths', () => {
  const validBody = {
    criptomonedaId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    cantidad: 0.5,
    direccionDestino: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  };

  test('validation failure (short address) -> joi middleware blocks at 400, no controller invoked', async () => {
    // joiValidate returns its own { success: false, errors: [...] } format at 400
    // The controller is not reached — no mock needed.
    const res = await request(buildWithdrawApp())
      .post('/withdraw')
      .send({ ...validBody, direccionDestino: 'short' });
    // Joi blocks it — must NOT be a 500 or reach controller
    expect(res.status).toBe(400);
    // joiValidate returns success:false format (not the AppError envelope — that is fine;
    // the joiValidate middleware predates this migration and is out of scope here)
    expect(res.body).toHaveProperty('errors');
  });

  test('insufficient balance -> 400 WITHDRAWAL_VALIDATION_FAILED (canonical envelope)', async () => {
    TransaccionBlockchain.validateWithdrawal.mockResolvedValue({
      valid: false,
      message: 'Saldo insuficiente para el retiro',
    });

    const res = await request(buildWithdrawApp()).post('/withdraw').send(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'WITHDRAWAL_VALIDATION_FAILED',
        message: 'Saldo insuficiente para el retiro',
      },
    });
  });

  test('invalid blockchain address -> 400 WITHDRAWAL_INVALID_ADDRESS (canonical envelope)', async () => {
    TransaccionBlockchain.validateWithdrawal.mockResolvedValue({
      valid: true,
      criptomoneda: { red: 'ethereum' },
    });
    const mockService = { validateAddress: jest.fn().mockResolvedValue(false) };
    BlockchainServiceManager.getService.mockReturnValue(mockService);

    const res = await request(buildWithdrawApp()).post('/withdraw').send(validBody);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'WITHDRAWAL_INVALID_ADDRESS',
        message: 'Dirección de destino inválida',
      },
    });
  });

  test('unexpected service throw -> sanitized 500, no raw message in body', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    TransaccionBlockchain.validateWithdrawal.mockRejectedValue(
      new Error('SECRET_DB_CREDS: pg connection failed')
    );

    const res = await request(buildWithdrawApp()).post('/withdraw').send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.text).not.toContain('SECRET_DB_CREDS');
    expect(res.text).not.toContain('pg connection failed');
    spy.mockRestore();
  });
});

// ── /deposit-address/:id ──────────────────────────────────────────────────────

describe('GET /deposit-address/:criptomonedaId — business error paths', () => {
  test('crypto not found -> 404 DEPOSIT_CRYPTO_NOT_FOUND (canonical envelope)', async () => {
    Criptomoneda.findByPk.mockResolvedValue(null);

    const res = await request(buildDepositAddressApp()).get('/deposit-address/some-id');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'DEPOSIT_CRYPTO_NOT_FOUND',
        message: 'Criptomoneda no encontrada o inactiva',
      },
    });
  });

  test('unexpected service throw -> sanitized 500, no raw message in body', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    Criptomoneda.findByPk.mockRejectedValue(new Error('SECRET_INTERNAL: crypto table missing'));

    const res = await request(buildDepositAddressApp()).get('/deposit-address/some-id');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.text).not.toContain('SECRET_INTERNAL');
    expect(res.text).not.toContain('crypto table missing');
    spy.mockRestore();
  });

  test('address generation failure -> 500 DEPOSIT_ADDRESS_GENERATION_FAILED (canonical envelope)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    Criptomoneda.findByPk.mockResolvedValue({ id: 'c1', activa: true, symbol: 'ETH', red: 'ethereum' });
    DireccionDeposito.getByUserAndCrypto.mockResolvedValue(null);
    DireccionDeposito.generateAddressForUser.mockRejectedValue(new Error('wallet key unavailable'));

    const res = await request(buildDepositAddressApp()).get('/deposit-address/c1');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('DEPOSIT_ADDRESS_GENERATION_FAILED');
    // Safe message only — must not leak the raw error
    expect(res.text).not.toContain('wallet key unavailable');
    spy.mockRestore();
  });
});

// ── getMyTransactions ─────────────────────────────────────────────────────────

describe('GET /my — unexpected throw -> sanitized 500', () => {
  function buildMyApp() {
    return buildApp('get', '/my', controller.getMyTransactions);
  }

  test('unexpected DB throw -> sanitized 500, no raw message', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    TransaccionBlockchain.getByUser.mockRejectedValue(new Error('SECRET: connection reset'));

    const res = await request(buildMyApp()).get('/my');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.text).not.toContain('SECRET');
    spy.mockRestore();
  });
});
