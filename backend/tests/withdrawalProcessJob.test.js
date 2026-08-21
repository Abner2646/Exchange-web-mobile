// tests/withdrawalProcessJob.test.js
//
// Cubre AUDITORIA_BACKEND.md Críticos #8: createWithdrawal bloqueaba el
// balance del usuario al crear el retiro, pero ningún job ni ruta llamaba
// a processPendingWithdrawals() — que ya estaba bien implementada por red
// — así que los retiros quedaban con fondos bloqueados para siempre.

jest.mock('../models', () => ({
  TransaccionBlockchain: {},
  DireccionDeposito: {},
  Criptomoneda: {},
  BlockchainState: {},
}));

jest.mock('../services/blockchain', () => ({
  getService: jest.fn(),
}));

const BlockchainServiceManager = require('../services/blockchain');
const BlockchainJobManager = require('../jobs/blockchain.jobs');

describe('BlockchainJobManager.runWithdrawalProcessJob', () => {
  beforeEach(() => jest.clearAllMocks());

  test('llama a processPendingWithdrawals en cada red disponible y suma los resultados', async () => {
    const ethService = { processPendingWithdrawals: jest.fn().mockResolvedValue([{ id: 'w1' }]) };
    const bscService = { processPendingWithdrawals: jest.fn().mockResolvedValue([]) };
    const btcService = { processPendingWithdrawals: jest.fn().mockResolvedValue([{ id: 'w2' }, { id: 'w3' }]) };

    BlockchainServiceManager.getService.mockImplementation((network) => {
      if (network === 'ethereum') return ethService;
      if (network === 'bsc') return bscService;
      if (network === 'bitcoin') return btcService;
      return null;
    });

    const result = await BlockchainJobManager.runWithdrawalProcessJob();

    expect(ethService.processPendingWithdrawals).toHaveBeenCalledTimes(1);
    expect(bscService.processPendingWithdrawals).toHaveBeenCalledTimes(1);
    expect(btcService.processPendingWithdrawals).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBe(3);
  });

  test('si un servicio no está disponible, lo saltea sin romper el resto', async () => {
    BlockchainServiceManager.getService.mockImplementation((network) => {
      if (network === 'ethereum') return null; // no disponible
      return { processPendingWithdrawals: jest.fn().mockResolvedValue([]) };
    });

    const result = await BlockchainJobManager.runWithdrawalProcessJob();

    expect(result.success).toBe(true);
    expect(result.results.find((r) => r.network === 'ethereum')).toBeUndefined();
  });

  test('si un servicio tira error, se registra como fallido sin frenar a los demás', async () => {
    const failingService = { processPendingWithdrawals: jest.fn().mockRejectedValue(new Error('RPC caído')) };
    const okService = { processPendingWithdrawals: jest.fn().mockResolvedValue([{ id: 'w1' }]) };

    BlockchainServiceManager.getService.mockImplementation((network) =>
      network === 'ethereum' ? failingService : okService
    );

    const result = await BlockchainJobManager.runWithdrawalProcessJob();

    const ethResult = result.results.find((r) => r.network === 'ethereum');
    expect(ethResult.success).toBe(false);
    expect(ethResult.error).toMatch(/RPC caído/);

    // bsc y bitcoin sí se procesaron pese al error de ethereum
    expect(result.totalProcessed).toBe(2);
  });
});
