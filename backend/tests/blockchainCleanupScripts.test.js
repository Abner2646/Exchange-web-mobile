// tests/blockchainCleanupScripts.test.js
//
// Cubre AUDITORIA_BACKEND.md Altos #6 y #7:
// - BlockchainJobManager.cleanupStuckTransactions() requería
//   '../scripts/cleanup-balance-checks', un archivo que no existe — el
//   real es cleanup-stuck-transactions.js.
// - transaccionBlockchain.model.js tenía una segunda implementación
//   (cleanupBalanceCheckTransactions) que hacía lo opuesto al script real
//   (acreditaba saldo en vez de limpiar) — se eliminó por completo.

jest.mock('../models', () => ({
  TransaccionBlockchain: { findAll: jest.fn().mockResolvedValue([]) },
  DireccionDeposito: {},
  Criptomoneda: {},
  BlockchainState: {},
  Usuario: {},
  BalanceUsuario: {},
}));
jest.mock('../services/blockchain', () => ({ getService: jest.fn() }));

const BlockchainJobManager = require('../jobs/blockchain.jobs');
const { TransaccionBlockchain } = require('../models');

describe('BlockchainJobManager.cleanupStuckTransactions', () => {
  test('el require apunta al script que realmente existe, no explota con MODULE_NOT_FOUND', async () => {
    const result = await BlockchainJobManager.cleanupStuckTransactions();
    expect(result.total).toBe(0);
    expect(TransaccionBlockchain.findAll).toHaveBeenCalled();
  });
});

describe('transaccionBlockchain.model.js', () => {
  test('cleanupBalanceCheckTransactions (la versión peligrosa que acreditaba saldo falso) ya no existe', () => {
    const { Sequelize } = require('sequelize');
    // No hace falta una conexión real: Model.init() no requiere que el
    // dialecto exista de verdad hasta que se ejecuta una query.
    const sequelize = new Sequelize('postgres://test:test@localhost:5432/test', { logging: false });
    const createTransaccionBlockchainModel = require('../models/transaccionBlockchain.model');
    const TransaccionBlockchainModel = createTransaccionBlockchainModel(sequelize);
    expect(TransaccionBlockchainModel.cleanupBalanceCheckTransactions).toBeUndefined();
  });
});
