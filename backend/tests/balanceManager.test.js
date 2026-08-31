// tests/balanceManager.test.js
//
// Fase 1 — migración de balanceManager a money.js. Antes calculaba los montos a
// bloquear/mover con parseFloat + aritmética de Number (float binario): un
// simple 0.1 * 0.2 daba 0.020000000000000004 y ese error viajaba directo al
// saldo bloqueado del usuario. Después: aritmética exacta con decimal.js y
// montos como string canónico, tanto en los deltas que mueven plata como en los
// valores de lectura que se devuelven al cliente.

jest.mock('../models', () => ({
  BalanceUsuario: {
    hasAvailableBalance: jest.fn(),
    blockBalance: jest.fn(),
    unblockBalance: jest.fn(),
    updateBalance: jest.fn(),
    getByUserAndCrypto: jest.fn(),
  },
  TradingPair: { findByPk: jest.fn() },
  sequelize: {},
}));

const { BalanceUsuario, TradingPair } = require('../models');
const balanceManager = require('../services/trading/balanceManager.service');

beforeEach(() => jest.clearAllMocks());

const pair = {
  quoteAssetId: 'q',
  baseAssetId: 'base',
  lastPrice: '0.2',
  takerFeePercent: '0.2',
};

describe('lockBalanceForOrder — monto a bloquear exacto', () => {
  test('compra market: bloquea quantity*price sin fee (el fee taker se cobra del base al liquidar), sin error de coma', async () => {
    BalanceUsuario.hasAvailableBalance.mockResolvedValue(true);

    const r = await balanceManager.lockBalanceForOrder({
      userId: 'u', tradingPair: pair, side: 'buy', quantity: '0.1', price: null,
    });

    // 0.1*0.2 = 0.02 exacto (float daría 0.020000000000000004). Sin reserva de
    // fee en quote: el fee taker sale del base recibido al liquidar (Radar #12a).
    expect(r.success).toBe(true);
    expect(r.amountLocked).toBe('0.02');
    expect(BalanceUsuario.blockBalance).toHaveBeenCalledWith('u', 'q', '0.02', null);
  });

  test('venta: bloquea la cantidad de base asset como string', async () => {
    BalanceUsuario.hasAvailableBalance.mockResolvedValue(true);

    const r = await balanceManager.lockBalanceForOrder({
      userId: 'u', tradingPair: pair, side: 'sell', quantity: '0.1', price: null,
    });

    expect(r.amountLocked).toBe('0.1');
    expect(BalanceUsuario.blockBalance).toHaveBeenCalledWith('u', 'base', '0.1', null);
  });
});

describe('unlockBalanceFromOrder — monto a desbloquear exacto', () => {
  test('compra: desbloquea quantityRemaining*price sin fee (simétrico con el lock), sin error de coma', async () => {
    const order = {
      side: 'buy', tradingPairId: 'p', quantityRemaining: '0.1', price: '0.2',
      feePercent: '0.2', userId: 'u',
      tradingPair: { quoteAssetId: 'q', baseAssetId: 'base', lastPrice: '0.2' },
    };
    const tx = {};

    const r = await balanceManager.unlockBalanceFromOrder(order, tx);

    expect(r.amountUnlocked).toBe('0.02');
    expect(BalanceUsuario.unblockBalance).toHaveBeenCalledWith('u', 'q', '0.02', tx);
  });
});

describe('updateBalancesAfterTrade — deltas exactos que mueven plata real', () => {
  test('reduce bloqueado / aumenta disponible sin error de coma', async () => {
    const trade = {
      buyerId: 'b', sellerId: 's', tradingPairId: 'p',
      quantity: '0.1', price: '0.2', buyerFee: '0.0001', sellerFee: '0.00004',
    };
    const buyOrder = { tradingPair: { quoteAssetId: 'q', baseAssetId: 'base' } };
    const tx = {};

    await balanceManager.updateBalancesAfterTrade(trade, buyOrder, {}, tx);

    // buyerQuoteAmount = 0.1*0.2 = 0.02  (float: 0.020000000000000004)
    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith('b', 'q', '-0.02', 'bloqueado', tx);
    // buyerBaseAmount = 0.1 - 0.0001 = 0.0999
    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith('b', 'base', '0.0999', 'disponible', tx);
    // seller bloqueado -0.1
    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith('s', 'base', '-0.1', 'bloqueado', tx);
    // sellerQuoteAmount = 0.02 - 0.00004 = 0.01996
    expect(BalanceUsuario.updateBalance).toHaveBeenCalledWith('s', 'q', '0.01996', 'disponible', tx);
  });
});

describe('checkSufficientBalance — requerido exacto como string', () => {
  test('compra: required = cantidad*precio (sin fee); available como string', async () => {
    TradingPair.findByPk.mockResolvedValue(pair);
    BalanceUsuario.getByUserAndCrypto.mockResolvedValue({ balanceDisponible: '0.03' });

    const r = await balanceManager.checkSufficientBalance('u', 'p', 'buy', '0.1', '0.2');

    expect(r.required).toBe('0.02');
    expect(r.available).toBe('0.03');
    expect(r.sufficient).toBe(true);
  });
});

describe('getTradingBalance — lectura como string exacto', () => {
  test('total = disponible + bloqueado, sin error de coma', async () => {
    BalanceUsuario.getByUserAndCrypto.mockResolvedValue({
      balanceDisponible: '0.1', balanceBloqueado: '0.2',
    });

    const r = await balanceManager.getTradingBalance('u', 'c');

    expect(r).toEqual({ available: '0.1', locked: '0.2', total: '0.3' });
  });
});
