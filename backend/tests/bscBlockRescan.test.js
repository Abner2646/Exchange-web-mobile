// tests/bscBlockRescan.test.js
//
// Cubre AUDITORIA_BACKEND.md Altos #9: bsc.service.js retrocedía siempre
// 10.000 bloques respecto al último procesado antes de escanear, marcado
// "TEMPORAL" pero nunca sacado — reconsultaba rangos ya procesados en
// cada ciclo (cada 60s por defecto). ETH, con la misma plantilla, no
// tiene este ajuste.

jest.mock('../models', () => ({
  TransaccionBlockchain: {},
  DireccionDeposito: {
    findAll: jest.fn().mockResolvedValue([
      {
        direccion: '0xUserAddress',
        criptomoneda: { symbol: 'BNB', red: 'bsc', direccionContrato: null, decimales: 18 },
      },
    ]),
  },
  Criptomoneda: {},
  BlockchainState: { getLastProcessedBlock: jest.fn().mockResolvedValue(500000) },
}), { virtual: false });

process.env.BSC_NETWORK = 'testnet';
process.env.NODE_ENV = 'test';
process.env.BSC_TESTNET_RPC_URL = 'https://example-testnet-rpc.invalid';
process.env.BNB_TESTNET_PRIVATE_KEY = 'a'.repeat(64);
process.env.ETHERSCAN_API_KEY = 'fake-key';

const BscService = require('../services/blockchain/bsc.service');

describe('BscService.scanWithEtherscanV2API', () => {
  test('escanea desde el último bloque procesado directo, sin retroceder 10k bloques', async () => {
    const bsc = new BscService();
    jest.spyOn(bsc, 'scanBNBTransactions').mockResolvedValue([]);

    await bsc.scanWithEtherscanV2API();

    expect(bsc.scanBNBTransactions).toHaveBeenCalledWith(
      expect.anything(),
      500000 // no 490000 (500000 - 10000)
    );
  });
});
