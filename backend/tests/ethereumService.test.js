// tests/ethereumService.test.js
//
// Fase 1 — precisión monetaria ETH. El envío on-chain ya es exacto (ethers
// parseEther/parseUnits usan BigInt), pero el fee de gas y el net del depósito
// pasaban por parseFloat (Number/float binario) antes de guardarse en columnas
// DECIMAL. Se testea sobre el prototipo para no ejecutar el constructor (que
// crea un ethers.Wallet y exige claves privadas por env).

jest.mock('../models', () => ({
  TransaccionBlockchain: { createDeposit: jest.fn() },
  DireccionDeposito: {},
  Criptomoneda: {},
  BlockchainState: {},
}));

const { TransaccionBlockchain } = require('../models');
const EthereumService = require('../services/blockchain/ethereum.service');

describe('ethereum.calculateTransactionFee — fee de gas exacto como string', () => {
  test('21000 gas @ 20 gwei = 0.00042 ETH (no Number)', () => {
    const fee = EthereumService.prototype.calculateTransactionFee.call(
      {}, { gasUsed: '21000', gasPrice: '20000000000' }
    );
    expect(fee).toBe('0.00042');
  });
});

describe('ethereum.createDepositFromTransaction — net y fee exactos', () => {
  beforeEach(() => jest.clearAllMocks());

  test('cantidad = amount - fee sin error de coma; fee como string', async () => {
    TransaccionBlockchain.createDeposit.mockResolvedValue({ id: 'd' });
    const tx = { from: '0xabc', hash: '0xh', confirmations: '3', blockNumber: '100', timeStamp: '1700000000' };

    await EthereumService.prototype.createDepositFromTransaction.call(
      { requiredConfirmations: 12 },
      { userId: 'u', criptomonedaId: 'c', direccion: '0xdst' }, tx, '0.3', '0.1'
    );

    const data = TransaccionBlockchain.createDeposit.mock.calls[0][0];
    // float: 0.3 - 0.1 = 0.19999999999999998
    expect(data.cantidad).toBe('0.2');
    expect(data.feeBlockchain).toBe('0.1');
  });
});
