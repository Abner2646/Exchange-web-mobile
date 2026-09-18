// tests/testnetFaucet.test.js
const AppError = require('../utils/AppError');

describe('claimTestnetFaucet controller', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
    jest.restoreAllMocks();
  });

  test('en producción arroja 404 AppError y no acredita nada', async () => {
    process.env.NODE_ENV = 'production';

    const { claimTestnetFaucet } = require('../modules/balances/userBalance.controller');
    const req = { user: { id: 'user-1' }, body: {} };
    const res = {};

    await expect(claimTestnetFaucet(req, res)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  test('en staging/testnet acredita USDT y BTC cuando symbol es ALL', async () => {
    process.env.NODE_ENV = 'test';

    const mockCreditFaucet = jest.fn().mockResolvedValue(true);
    const mockGetBalancesWithCompartments = jest.fn().mockResolvedValue([
      { symbol: 'USDT', availableBalance: '10000.00000000' },
      { symbol: 'BTC', availableBalance: '1.00000000' },
    ]);

    const mockCrypto = {
      getBySymbol: jest.fn((sym) => {
        if (sym === 'USDT') return Promise.resolve({ id: 'usdt-id', symbol: 'USDT' });
        if (sym === 'BTC') return Promise.resolve({ id: 'btc-id', symbol: 'BTC' });
        return Promise.resolve(null);
      }),
    };

    const mockTransaction = {
      commit: jest.fn().mockResolvedValue(true),
      rollback: jest.fn().mockResolvedValue(true),
      finished: false,
    };

    jest.doMock('../models/index.js', () => ({
      UserBalance: {
        getBalancesWithCompartments: mockGetBalancesWithCompartments,
      },
      sequelize: {
        models: { Crypto: mockCrypto },
        transaction: jest.fn().mockResolvedValue(mockTransaction),
      },
    }));

    jest.doMock('../modules/balances/ledger/operations', () => ({
      transferInternal: jest.fn(),
      transferBetweenCompartments: jest.fn(),
      creditFaucet: mockCreditFaucet,
    }));

    const { claimTestnetFaucet } = require('../modules/balances/userBalance.controller');

    const req = {
      user: { id: 'user-1' },
      body: { symbol: 'ALL' },
    };

    let responsePayload = null;
    const res = {
      json: (payload) => {
        responsePayload = payload;
      },
    };

    await claimTestnetFaucet(req, res);

    expect(mockCreditFaucet).toHaveBeenCalledTimes(2);
    expect(mockCreditFaucet).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', criptomonedaId: 'usdt-id', cantidad: '10000' }),
      mockTransaction
    );
    expect(mockCreditFaucet).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', criptomonedaId: 'btc-id', cantidad: '1' }),
      mockTransaction
    );
    expect(mockTransaction.commit).toHaveBeenCalled();
    expect(responsePayload).toBeTruthy();
    expect(responsePayload.data.credited).toEqual([
      { symbol: 'USDT', amount: '10000' },
      { symbol: 'BTC', amount: '1' },
    ]);
  });
});
