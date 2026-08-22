// tests/walletMaestra.model.test.js
//
// Fase 1 — precisión monetaria. La wallet maestra custodia TODOS los fondos
// on-chain; addToBalance/subtractFromBalance acumulaban el balance con
// `parseFloat(balanceTotal) ± parseFloat(cantidad)` (float binario) — mismo bug
// de coma que tenía BalanceUsuario. syncBalance reconciliaba contra la
// blockchain con resta/abs float. balanceTotal es DECIMAL(28,8): con money.js la
// acumulación y la diferencia son exactas y se guardan como string canónico.

jest.mock('../models/entities/walletMaestra.entity');

const initWalletMaestra = require('../models/entities/walletMaestra.entity');
const createWalletMaestraModel = require('../models/walletMaestra.model');

const fakeModel = {};
initWalletMaestra.mockReturnValue(fakeModel);
const sequelize = { transaction: jest.fn(), models: {} };
const WalletMaestra = createWalletMaestraModel(sequelize);

beforeEach(() => jest.clearAllMocks());

describe('WalletMaestra.addToBalance — acumula custodia exacto', () => {
  test('0.1 + 0.2 guarda "0.3", no 0.30000000000000004', async () => {
    const wallet = { balanceTotal: '0.1', metadata: {} };
    WalletMaestra.findByPk = jest.fn().mockResolvedValue(wallet);
    WalletMaestra.update = jest.fn().mockResolvedValue();

    const tx = {}; // transacción compartida: updateBalance no abre la propia
    const result = await WalletMaestra.addToBalance('w1', '0.2', tx);

    const updateArg = WalletMaestra.update.mock.calls[0][0];
    expect(updateArg.balanceTotal).toBe('0.3');
    expect(result.balanceTotal).toBe('0.3');
  });

  test('rechaza balance resultante negativo', async () => {
    const wallet = { balanceTotal: '0.1', metadata: {} };
    WalletMaestra.findByPk = jest.fn().mockResolvedValue(wallet);

    await expect(WalletMaestra.addToBalance('w1', '-0.5', {})).rejects.toThrow(/negativo/i);
  });
});

describe('WalletMaestra.subtractFromBalance — resta custodia exacto', () => {
  test('0.3 - 0.1 guarda "0.2", no 0.19999999999999998', async () => {
    const wallet = { balanceTotal: '0.3', metadata: {} };
    WalletMaestra.findByPk = jest.fn().mockResolvedValue(wallet);
    WalletMaestra.update = jest.fn().mockResolvedValue();

    await WalletMaestra.subtractFromBalance('w1', '0.1', {});

    const updateArg = WalletMaestra.update.mock.calls[0][0];
    expect(updateArg.balanceTotal).toBe('0.2');
  });

  test('rechaza si el balance es insuficiente', async () => {
    const wallet = { balanceTotal: '0.05', metadata: {} };
    WalletMaestra.findByPk = jest.fn().mockResolvedValue(wallet);

    await expect(WalletMaestra.subtractFromBalance('w1', '0.1', {})).rejects.toThrow(/insuficiente/i);
  });
});

describe('WalletMaestra.syncBalance — diferencia con blockchain exacta', () => {
  test('detecta diff > tolerancia y reporta difference exacto', async () => {
    const wallet = { id: 'w1', balanceTotal: '1', metadata: {} };
    WalletMaestra.findByPk = jest.fn().mockResolvedValue(wallet);
    WalletMaestra.update = jest.fn().mockResolvedValue();
    WalletMaestra.getById = jest.fn().mockResolvedValue(wallet);
    sequelize.transaction.mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() });

    const r = await WalletMaestra.syncBalance('w1', '1.00000002');

    expect(r.synchronized).toBe(true);
    // float: 1.00000002 - 1 = 0.000000020000000000575...
    expect(r.difference).toBe('0.00000002');
    expect(r.newBalance).toBe('1.00000002');
  });
});
