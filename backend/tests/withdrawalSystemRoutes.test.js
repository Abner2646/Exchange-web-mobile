// tests/withdrawalSystemRoutes.test.js
//
// Cubre AUDITORIA_BACKEND.md Críticos #8: las rutas /system/process-withdrawals
// (y scan-deposits, update-confirmations) estaban comentadas. Ahora que
// llaman a algo real (BlockchainJobManager), confirma que están montadas y
// protegidas por role de admin.

process.env.JWT_SECRET = 'test-secret';

jest.mock('../models', () => ({
  User: { findByPk: jest.fn() },
  BlockchainTransaction: {},
  Crypto: {},
  UserBalance: {},
  DepositAddress: {},
}));

jest.mock('../jobs/blockchain.jobs', () => ({
  runDepositScanJob: jest.fn().mockResolvedValue({ success: true }),
  runWithdrawalProcessJob: jest.fn().mockResolvedValue({ success: true, totalProcessed: 0 }),
  runConfirmationUpdateJob: jest.fn().mockResolvedValue([]),
}));

jest.mock('../services/blockchain', () => ({}));

const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
const { User } = require('../models');
const BlockchainJobManager = require('../jobs/blockchain.jobs');
const transaccionBlockchainRoutes = require('../routes/transaccionBlockchain.routes');
const errorHandler = require('../middleware/errorHandler');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/transaccionBlockchain', transaccionBlockchainRoutes);
  // requireOperatorMFA (Fase 4.9) rechaza vía next(AppError) → el envelope lo
  // produce el handler central.
  app.use(errorHandler);
  return app;
}

function tokenFor(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET);
}

describe('POST /transaccionBlockchain/system/process-withdrawals', () => {
  const app = buildApp();

  beforeEach(() => jest.clearAllMocks());

  test('un usuario normal no puede disparar el procesamiento de retiros', async () => {
    User.findByPk.mockResolvedValue({ id: 'u1', active: true, role: 'usuario', emailVerified: true });

    const res = await request(app)
      .post('/transaccionBlockchain/system/process-withdrawals')
      .set('Authorization', `Bearer ${tokenFor('u1')}`);

    expect(res.status).toBe(403);
    expect(BlockchainJobManager.runWithdrawalProcessJob).not.toHaveBeenCalled();
  });

  test('un admin CON 2FA sí puede, y la ruta llama al job real (no a un método inexistente)', async () => {
    User.findByPk.mockResolvedValue({ id: 'admin1', active: true, role: 'admin', emailVerified: true, twoFactorEnabled: true });

    const res = await request(app)
      .post('/transaccionBlockchain/system/process-withdrawals')
      .set('Authorization', `Bearer ${tokenFor('admin1')}`);

    expect(res.status).toBe(200);
    expect(BlockchainJobManager.runWithdrawalProcessJob).toHaveBeenCalledTimes(1);
  });

  test('un admin SIN 2FA no puede (Fase 4.9: MFA obligatorio para operadores)', async () => {
    User.findByPk.mockResolvedValue({ id: 'admin2', active: true, role: 'admin', emailVerified: true, twoFactorEnabled: false });

    const res = await request(app)
      .post('/transaccionBlockchain/system/process-withdrawals')
      .set('Authorization', `Bearer ${tokenFor('admin2')}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OPERATOR_MFA_REQUIRED');
    expect(BlockchainJobManager.runWithdrawalProcessJob).not.toHaveBeenCalled();
  });
});
