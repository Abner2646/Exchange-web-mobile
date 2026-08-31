// backend/tests/transferenciaReenviarCodigoResilience.test.js
//
// Fase 1 — resiliencia de transferencia.reenviarCodigo. reenviarCodigo llama a
// Transferencia.reenviarCodigo(id), que YA COMMITEA un código nuevo + expiración
// en la DB. Después hace 3 lookups (remitente/destinatario/criptomoneda) solo
// para armar el email. Esos lookups estaban FUERA del try/catch del envío: si
// alguno rechazaba (hiccup de DB), la excepción propagaba un 500 aunque el
// código ya se había regenerado y persistido — el usuario veía un error de una
// operación que en realidad tuvo éxito (y podía reintentar, quemando otro
// código). El envío del email ya se trataba como no-fatal; los lookups que lo
// alimentan deben serlo también.

const request = require('supertest');
const express = require('express');

jest.mock('../models/index.js', () => ({
  Transferencia: {
    getById: jest.fn(),
    reenviarCodigo: jest.fn(),
  },
  Usuario: { findByPk: jest.fn() },
  Criptomoneda: { getById: jest.fn() },
  BalanceUsuario: {},
  Notificaciones: {},
  sequelize: { transaction: jest.fn() },
}));

const { Transferencia, Usuario, Criptomoneda } = require('../models/index.js');

const asyncHandler = require('../utils/asyncHandler');
const errorHandler = require('../middleware/errorHandler');
const { reenviarCodigo } = require('../controllers/transferencia.controller');

// The controller sends through the injectable seam (req.app.locals.emailService),
// so the test injects a fake there and asserts on it — same pattern as the auth
// and integration suites.
let fakeEmail;

function buildApp() {
  const app = express();
  app.locals.emailService = fakeEmail;
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 'user-sender-id' };
    next();
  });
  app.post('/transfers/:id/resend-code', asyncHandler(reenviarCodigo));
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  fakeEmail = { enviarCodigoTransferencia: jest.fn().mockResolvedValue(undefined) };
});

function setupHappyPathUntilLookups() {
  Transferencia.getById.mockResolvedValue({
    id: 'tx-id',
    usuarioRemitenteId: 'user-sender-id',
  });
  Transferencia.reenviarCodigo.mockResolvedValue({
    transferencia: {
      id: 'tx-id',
      usuarioDestinatarioId: 'dest-id',
      criptomonedaId: 'crypto-id',
      cantidad: '0.5',
      expiracionCodigo: new Date('2026-01-01T00:00:00Z'),
    },
    codigo: '654321',
  });
}

describe('reenviarCodigo — resiliencia post-commit', () => {
  test('un lookup de email-prep que rechaza NO vuelve fatal la operación (código ya regenerado)', async () => {
    setupHappyPathUntilLookups();
    // remitente lookup rechaza (hiccup de DB) — pero el código ya se commiteó.
    Usuario.findByPk.mockRejectedValue(new Error('DB connection reset'));

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(buildApp()).post('/transfers/tx-id/resend-code').send({});
    spy.mockRestore();

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/reenviado/i);
    expect(res.body.data.id).toBe('tx-id');
  });

  test('email enviado en el happy path (lookups OK)', async () => {
    setupHappyPathUntilLookups();
    Usuario.findByPk
      .mockResolvedValueOnce({ email: 'sender@x.com', username: 'sender' })
      .mockResolvedValueOnce({ username: 'dest' });
    Criptomoneda.getById.mockResolvedValue({ symbol: 'BTC' });

    const res = await request(buildApp()).post('/transfers/tx-id/resend-code').send({});

    expect(res.status).toBe(200);
    expect(fakeEmail.enviarCodigoTransferencia).toHaveBeenCalledWith(
      'sender@x.com', '654321', 'sender', '0.5', 'BTC', 'dest'
    );
  });
});
