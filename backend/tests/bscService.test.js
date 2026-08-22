// tests/bscService.test.js
//
// Fase 1 — precisión monetaria BSC. Mismo patrón que ETH: el envío on-chain ya
// es exacto (ethers parseEther/parseUnits), pero el fee de gas y el net del
// depósito pasaban por parseFloat antes de guardarse en columnas DECIMAL. Se
// testea sobre el prototipo para no ejecutar el constructor (crea un
// ethers.Wallet y exige claves privadas por env).

jest.mock('../models', () => ({
  TransaccionBlockchain: { createDeposit: jest.fn() },
  DireccionDeposito: {},
  Criptomoneda: {},
  BlockchainState: {},
}));

const { TransaccionBlockchain } = require('../models');
const BscService = require('../services/blockchain/bsc.service');

describe('bsc.calculateTransactionFee — fee de gas exacto como string', () => {
  test('21000 gas @ 5 gwei = 0.000105 BNB (no Number)', () => {
    const fee = BscService.prototype.calculateTransactionFee.call(
      {}, { gasUsed: '21000', gasPrice: '5000000000' }
    );
    expect(fee).toBe('0.000105');
  });
});

describe('bsc.createDepositFromTransaction — net y fee exactos', () => {
  beforeEach(() => jest.clearAllMocks());

  test('cantidad = amount - fee sin error de coma; fee como string', async () => {
    TransaccionBlockchain.createDeposit.mockResolvedValue({ id: 'd' });
    const tx = { from: '0xabc', hash: '0xh', confirmations: '3', blockNumber: '100', timeStamp: '1700000000' };

    await BscService.prototype.createDepositFromTransaction.call(
      { requiredConfirmations: 6 },
      { userId: 'u', criptomonedaId: 'c', direccion: '0xdst' }, tx, '0.3', '0.1'
    );

    const data = TransaccionBlockchain.createDeposit.mock.calls[0][0];
    expect(data.cantidad).toBe('0.2');
    expect(data.feeBlockchain).toBe('0.1');
  });
});
