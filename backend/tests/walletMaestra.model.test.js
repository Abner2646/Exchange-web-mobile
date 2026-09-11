// tests/walletMaestra.model.test.js
//
// Fase 1 — precisión monetaria. La wallet maestra custodia TODOS los fondos
// on-chain; addToBalance/subtractFromBalance acumulaban el balance con
// `parseFloat(totalBalance) ± parseFloat(cantidad)` (float binario) — mismo bug
// de coma que tenía UserBalance. syncBalance reconciliaba contra la
// blockchain con resta/abs float. totalBalance es DECIMAL(28,8): con money.js la
// acumulación y la diferencia son exactas y se guardan como string canónico.

jest.mock('../models/entities/walletMaestra.entity');

const initWalletMaestra = require('../models/entities/walletMaestra.entity');
const createWalletMaestraModel = require('../models/walletMaestra.model');

const fakeModel = {};
initWalletMaestra.mockReturnValue(fakeModel);
const sequelize = { transaction: jest.fn(), models: {} };
const MasterWallet = createWalletMaestraModel(sequelize);

beforeEach(() => jest.clearAllMocks());

describe('MasterWallet.addToBalance — acumula custodia exacto', () => {
  test('0.1 + 0.2 guarda "0.3", no 0.30000000000000004', async () => {
    const wallet = { totalBalance: '0.1', metadata: {} };
    MasterWallet.findByPk = jest.fn().mockResolvedValue(wallet);
    MasterWallet.update = jest.fn().mockResolvedValue();

    const tx = {}; // transacción compartida: updateBalance no abre la propia
    const result = await MasterWallet.addToBalance('w1', '0.2', tx);

    const updateArg = MasterWallet.update.mock.calls[0][0];
    expect(updateArg.totalBalance).toBe('0.3');
    expect(result.totalBalance).toBe('0.3');
  });

  test('rechaza balance resultante negativo', async () => {
    const wallet = { totalBalance: '0.1', metadata: {} };
    MasterWallet.findByPk = jest.fn().mockResolvedValue(wallet);

    await expect(MasterWallet.addToBalance('w1', '-0.5', {})).rejects.toThrow(/negativo/i);
  });
});

describe('MasterWallet.subtractFromBalance — resta custodia exacto', () => {
  test('0.3 - 0.1 guarda "0.2", no 0.19999999999999998', async () => {
    const wallet = { totalBalance: '0.3', metadata: {} };
    MasterWallet.findByPk = jest.fn().mockResolvedValue(wallet);
    MasterWallet.update = jest.fn().mockResolvedValue();

    await MasterWallet.subtractFromBalance('w1', '0.1', {});

    const updateArg = MasterWallet.update.mock.calls[0][0];
    expect(updateArg.totalBalance).toBe('0.2');
  });

  test('rechaza si el balance es insuficiente', async () => {
    const wallet = { totalBalance: '0.05', metadata: {} };
    MasterWallet.findByPk = jest.fn().mockResolvedValue(wallet);

    await expect(MasterWallet.subtractFromBalance('w1', '0.1', {})).rejects.toThrow(/insuficiente/i);
  });
});

describe('MasterWallet.syncBalance — diferencia con blockchain exacta', () => {
  test('detecta diff > tolerancia y reporta difference exacto', async () => {
    const wallet = { id: 'w1', totalBalance: '1', metadata: {} };
    MasterWallet.findByPk = jest.fn().mockResolvedValue(wallet);
    MasterWallet.update = jest.fn().mockResolvedValue();
    MasterWallet.getById = jest.fn().mockResolvedValue(wallet);
    sequelize.transaction.mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() });

    const r = await MasterWallet.syncBalance('w1', '1.00000002');

    expect(r.synchronized).toBe(true);
    // float: 1.00000002 - 1 = 0.000000020000000000575...
    expect(r.difference).toBe('0.00000002');
    expect(r.newBalance).toBe('1.00000002');
  });
});
