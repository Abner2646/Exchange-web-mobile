// tests/balanceManager.test.js
//
// Fase 1 — migración de balanceManager a money.js: aritmética exacta con
// decimal.js y montos como string canónico en los deltas que mueven plata y en
// los valores de lectura. Endurecido 2026-08-31 con mutation testing (Stryker).
// Actualizado 2026-09-02 (Task 6): service reapuntado a Spot — mocks ajustados
// para hasAvailableInCompartment/getCompartmentBalance/getByUserIdCompartment
// y reserveForOrder/releaseReservation.

jest.mock('../models', () => ({
  UserBalance: {
    hasAvailableInCompartment: jest.fn(),
    getCompartmentBalance: jest.fn(),
    getByUserIdCompartment: jest.fn(),
    // Legacy Funding methods kept for P2P/withdrawals (untouched paths):
    hasAvailableBalance: jest.fn(),
    blockBalance: jest.fn(),
    unblockBalance: jest.fn(),
    updateBalance: jest.fn(),
    getByUserAndCrypto: jest.fn(),
  },
  TradingPair: { findByPk: jest.fn() },
  sequelize: {},
}));

// Paso D: el settlement del trade liquida en el ledger vía settleTrade
// (comprador↔vendedor + fee_revenue por lado). Task 6: también mockea
// reserveForOrder y releaseReservation (spot order lifecycle).
jest.mock('../modules/balances/ledger/operations', () => ({
  settleTrade: jest.fn(),
  reserveForOrder: jest.fn(),
  releaseReservation: jest.fn(),
}));

const { UserBalance, TradingPair } = require('../models');
const { settleTrade, reserveForOrder, releaseReservation } = require('../modules/balances/ledger/operations');
const balanceManager = require('../modules/trading/balanceManager.service');

beforeEach(() => jest.clearAllMocks());

const pair = {
  quoteAssetId: 'q',
  baseAssetId: 'base',
  lastPrice: '0.2',
  takerFeePercent: '0.2',
};

describe('lockBalanceForOrder — monto a bloquear exacto', () => {
  test('compra market: reserva quantity*price en Spot sin fee (el fee taker se cobra del base al liquidar), sin error de coma', async () => {
    UserBalance.hasAvailableInCompartment.mockResolvedValue(true);
    reserveForOrder.mockResolvedValue();

    const r = await balanceManager.lockBalanceForOrder({
      userId: 'u', tradingPair: pair, side: 'buy', quantity: '0.1', price: null,
    });

    // 0.1*0.2 = 0.02 exacto (float daría 0.020000000000000004). Sin reserva de
    // fee en quote: el fee taker sale del base recibido al liquidar (Radar #12a).
    expect(r.success).toBe(true);
    expect(r.assetLocked).toBe('q');
    expect(r.amountLocked).toBe('0.02');
    expect(UserBalance.hasAvailableInCompartment).toHaveBeenCalledWith('u', 'q', '0.02', 'spot', null);
    expect(reserveForOrder).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u', cryptoId: 'q', quantity: '0.02' }),
      null
    );
  });

  test('venta: reserva la cantidad de base asset en Spot como string', async () => {
    UserBalance.hasAvailableInCompartment.mockResolvedValue(true);
    reserveForOrder.mockResolvedValue();

    const r = await balanceManager.lockBalanceForOrder({
      userId: 'u', tradingPair: pair, side: 'sell', quantity: '0.1', price: null,
    });

    expect(r.success).toBe(true);
    expect(r.assetLocked).toBe('base');
    expect(r.amountLocked).toBe('0.1');
    expect(UserBalance.hasAvailableInCompartment).toHaveBeenCalledWith('u', 'base', '0.1', 'spot', null);
    expect(reserveForOrder).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u', cryptoId: 'base', quantity: '0.1' }),
      null
    );
  });

  test('precio no positivo (0) → success:false con error de precio, no reserva', async () => {
    // rawPrice = '0' (truthy) pero compare('0','0') <= 0 → guard dispara.
    const r = await balanceManager.lockBalanceForOrder({
      userId: 'u', tradingPair: pair, side: 'buy', quantity: '0.1', price: '0',
    });

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/determinar el precio/i);
    expect(reserveForOrder).not.toHaveBeenCalled();
  });

  test('balance insuficiente en Spot → success:false, no reserva', async () => {
    UserBalance.hasAvailableInCompartment.mockResolvedValue(false);

    const r = await balanceManager.lockBalanceForOrder({
      userId: 'u', tradingPair: pair, side: 'buy', quantity: '0.1', price: '0.2',
    });

    expect(r.success).toBe(false);
    expect(r.error).toMatch(/insuficiente/i);
    expect(reserveForOrder).not.toHaveBeenCalled();
  });
});

describe('unlockBalanceFromOrder — monto a desbloquear exacto', () => {
  test('compra: libera quantityRemaining * order.price en Spot (no lastPrice), sin error de coma', async () => {
    releaseReservation.mockResolvedValue();
    const order = {
      side: 'buy', tradingPairId: 'p', quantityRemaining: '0.1', price: '0.3',
      feePercent: '0.2', userId: 'u',
      tradingPair: { quoteAssetId: 'q', baseAssetId: 'base', lastPrice: '0.2' },
    };
    const tx = {};

    const r = await balanceManager.unlockBalanceFromOrder(order, tx);

    expect(r.success).toBe(true);
    expect(r.assetUnlocked).toBe('q');
    expect(r.amountUnlocked).toBe('0.03'); // 0.1*0.3 (order.price), NO 0.1*0.2 (lastPrice)
    expect(releaseReservation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u', cryptoId: 'q', quantity: '0.03' }),
      tx
    );
  });

  test('venta: libera la cantidad en base asset de Spot', async () => {
    releaseReservation.mockResolvedValue();
    const order = {
      side: 'sell', tradingPairId: 'p', quantityRemaining: '0.1', userId: 'u',
      tradingPair: { quoteAssetId: 'q', baseAssetId: 'base', lastPrice: '0.2' },
    };
    const tx = {};

    const r = await balanceManager.unlockBalanceFromOrder(order, tx);

    expect(r.success).toBe(true);
    expect(r.assetUnlocked).toBe('base');
    expect(r.amountUnlocked).toBe('0.1');
    expect(releaseReservation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u', cryptoId: 'base', quantity: '0.1' }),
      tx
    );
  });

  test('sin trading pair (ni en el order ni en la DB) → lanza "no encontrado"', async () => {
    TradingPair.findByPk.mockResolvedValue(null);
    const order = { side: 'buy', tradingPairId: 'p', quantityRemaining: '0.1', price: '0.2', feePercent: '0.2', userId: 'u' };

    await expect(balanceManager.unlockBalanceFromOrder(order, {})).rejects.toThrow(/no encontrado/i);
  });
});

describe('updateBalancesAfterTrade — delega la liquidación al ledger', () => {
  test('llama a settleTrade con montoQuote y fees exactos, en la transacción, y devuelve success:true', async () => {
    const trade = {
      id: 't1', buyerId: 'b', sellerId: 's', tradingPairId: 'p',
      quantity: '0.1', price: '0.2', buyerFee: '0.0001', sellerFee: '0.00004',
    };
    const buyOrder = { tradingPair: { quoteAssetId: 'q', baseAssetId: 'base' } };
    const tx = {};

    const r = await balanceManager.updateBalancesAfterTrade(trade, buyOrder, {}, tx);

    expect(r.success).toBe(true);
    expect(settleTrade).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerId: 'b',
        sellerId: 's',
        baseAssetId: 'base',
        quoteAssetId: 'q',
        quantity: '0.1',
        quoteAmount: '0.02', // 0.1*0.2 exacto (float daría 0.020000000000000004)
        buyerFee: '0.0001',
        sellerFee: '0.00004',
        referencia: 'trade:t1',
      }),
      tx
    );
  });
});

describe('checkSufficientBalance — requerido exacto como string', () => {
  test('compra: required = cantidad * price (usa el price pasado, no lastPrice); pide quote asset de Spot', async () => {
    TradingPair.findByPk.mockResolvedValue(pair);
    UserBalance.getCompartmentBalance.mockResolvedValue({ available: '0.05', blocked: '0', pending: '0' });

    // price 0.3 distinto de lastPrice 0.2.
    const r = await balanceManager.checkSufficientBalance('u', 'p', 'buy', '0.1', '0.3');

    expect(r.required).toBe('0.03'); // 0.1*0.3, no 0.1*0.2
    expect(r.available).toBe('0.05');
    expect(r.sufficient).toBe(true);
    expect(UserBalance.getCompartmentBalance).toHaveBeenCalledWith('u', 'q', 'spot'); // quote para compra, Spot
  });

  test('venta: required = cantidad (base asset)', async () => {
    TradingPair.findByPk.mockResolvedValue(pair);
    UserBalance.getCompartmentBalance.mockResolvedValue({ available: '1', blocked: '0', pending: '0' });

    const r = await balanceManager.checkSufficientBalance('u', 'p', 'sell', '0.1', '0.2');

    expect(r.required).toBe('0.1');
    expect(r.sufficient).toBe(true);
    expect(UserBalance.getCompartmentBalance).toHaveBeenCalledWith('u', 'base', 'spot'); // base para venta, Spot
  });

  test('insuficiente: disponible < requerido → sufficient false', async () => {
    TradingPair.findByPk.mockResolvedValue(pair);
    UserBalance.getCompartmentBalance.mockResolvedValue({ available: '0.01', blocked: '0', pending: '0' }); // < 0.02

    const r = await balanceManager.checkSufficientBalance('u', 'p', 'buy', '0.1', '0.2');

    expect(r.sufficient).toBe(false);
    expect(r.error).toMatch(/insuficiente/i);
  });

  test('borde: disponible == requerido → sufficient true', async () => {
    TradingPair.findByPk.mockResolvedValue(pair);
    UserBalance.getCompartmentBalance.mockResolvedValue({ available: '0.02', blocked: '0', pending: '0' }); // == 0.02

    const r = await balanceManager.checkSufficientBalance('u', 'p', 'buy', '0.1', '0.2');

    expect(r.sufficient).toBe(true);
  });

  test('sin trading pair → sufficient false con error "no encontrado"', async () => {
    TradingPair.findByPk.mockResolvedValue(null);

    const r = await balanceManager.checkSufficientBalance('u', 'p', 'buy', '0.1', '0.2');

    expect(r.sufficient).toBe(false);
    expect(r.error).toMatch(/no encontrado/i);
  });

  test('sin balance en Spot (getCompartmentBalance devuelve 0) → sufficient false, available "0"', async () => {
    TradingPair.findByPk.mockResolvedValue(pair);
    UserBalance.getCompartmentBalance.mockResolvedValue({ available: '0', blocked: '0', pending: '0' });

    const r = await balanceManager.checkSufficientBalance('u', 'p', 'buy', '0.1', '0.2');

    expect(r.sufficient).toBe(false);
    expect(r.available).toBe('0');
    expect(r.error).toMatch(/insuficiente/i);
  });
});

describe('getTradingBalance — lectura Spot como string exacto', () => {
  test('total = disponible + bloqueado desde Spot, sin error de coma', async () => {
    UserBalance.getCompartmentBalance.mockResolvedValue({
      available: '0.1', blocked: '0.2', pending: '0',
    });

    const r = await balanceManager.getTradingBalance('u', 'c');

    expect(r).toEqual({ available: '0.1', locked: '0.2', total: '0.3' });
    expect(UserBalance.getCompartmentBalance).toHaveBeenCalledWith('u', 'c', 'spot');
  });

  test('sin balance en Spot (getCompartmentBalance devuelve 0) → devuelve ceros (no lanza)', async () => {
    UserBalance.getCompartmentBalance.mockResolvedValue({ available: '0', blocked: '0', pending: '0' });

    const r = await balanceManager.getTradingBalance('u', 'c');

    expect(r).toEqual({ available: '0', locked: '0', total: '0' });
  });
});
