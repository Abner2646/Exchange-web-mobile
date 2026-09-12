// tests/transaccionesP2P.model.test.js
//
// Fase 1 — precisión monetaria en el P2P. createTransaction computaba el monto
// fiat con `amount * parseFloat(unitPrice)` (float binario) y bloqueaba
// los fondos pasando `parseFloat(amount)` a UserBalance.updateBalance,
// contaminando el monto antes del borde exacto. amount/fiatAmount son DECIMAL:
// con money.js el fiat y los montos bloqueados son exactos como string.

jest.mock('../modules/p2p/p2pTransaction.entity');
jest.mock('../models/index', () => ({
  P2POffer: {},
  UserBalance: {},
  Notification: {},
}));

const initTransaccionP2P = require('../modules/p2p/p2pTransaction.entity');
const { P2POffer, UserBalance, Notification } = require('../models/index');
const createTransaccionP2PModel = require('../modules/p2p/p2pTransaction.model');

const fakeModel = {};
initTransaccionP2P.mockReturnValue(fakeModel);
const sequelize = { transaction: jest.fn() };
const P2PTransaction = createTransaccionP2PModel(sequelize);

beforeEach(() => jest.clearAllMocks());

describe('P2PTransaction.createTransaction — fiatAmount y bloqueo exactos', () => {
  test('fiatAmount = amount*precio y bloqueo negativo sin error de coma', async () => {
    sequelize.transaction.mockResolvedValue({ commit: jest.fn(), rollback: jest.fn(), finished: false });
    P2POffer.findByPk = jest.fn().mockResolvedValue({
      active: true, minAmount: '0.01', maxAmount: '10',
      crypto: { symbol: 'BTC' }, fiatCurrency: 'USD',
    });
    UserBalance.getByUserAndCrypto = jest.fn().mockResolvedValue({ availableBalance: '5' });
    UserBalance.blockBalance = jest.fn().mockResolvedValue();
    P2PTransaction.create = jest.fn().mockResolvedValue({ id: 'tx1' });
    P2PTransaction.getById = jest.fn().mockResolvedValue({ id: 'tx1' });
    Notification.notifyBothParties = jest.fn().mockResolvedValue();

    await P2PTransaction.createTransaction({
      offerId: 'o1', buyerId: 'c', sellerId: 'v', cryptoId: 'crypto',
      amount: '0.1', unitPrice: '0.2', paymentMethodId: 'm1',
    });

    // fiatAmount = 0.1 * 0.2 = 0.02 (float: 0.020000000000000004)
    const createArg = P2PTransaction.create.mock.calls[0][0];
    expect(createArg.fiatAmount).toBe('0.02');
    expect(createArg.amount).toBe('0.1');

    // Paso D: el bloqueo de fondos del vendedor delega en blockBalance (dos patas
    // de usuario, sin suspense) con la amount exacta como string.
    expect(UserBalance.blockBalance).toHaveBeenCalledWith('v', 'crypto', '0.1', expect.anything());
  });
});
