const { buy, resolvePresale } = require('./launchpad.service');
const { Presale, Contribution } = require('./launchpad.model');
const { postTransaction } = require('../balances/ledger/postingService');
const { PURPOSES } = require('../balances/ledger/ledgerAccounts');
const money = require('../../utils/money');
const { Crypto } = require('../../models');

jest.mock('../../models', () => {
  const transactionMock = jest.fn((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
  return {
    sequelize: {
      transaction: transactionMock,
      models: {}
    },
    Crypto: { getBySymbol: jest.fn() }
  };
});

jest.mock('./launchpad.model', () => ({
  Presale: { findByPk: jest.fn() },
  Contribution: { findAll: jest.fn(), create: jest.fn() }
}));

jest.mock('../balances/ledger/postingService', () => ({
  postTransaction: jest.fn()
}));

describe('Launchpad Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buy', () => {
    it('debits USDT from user funding available and enforces limits', async () => {
      const now = new Date();
      const fakePresale = {
        id: 'presale-1',
        tokenCryptoId: 'token-uuid',
        priceUsdt: '2',
        hardCapUsdt: '1000',
        softCapUsdt: '500',
        minTicketUsdt: '10',
        maxTicketUsdt: '100',
        startDate: new Date(now.getTime() - 10000),
        endDate: new Date(now.getTime() + 10000),
        status: 'ACTIVE',
        totalRaisedUsdt: '100',
        update: jest.fn()
      };
      
      Presale.findByPk.mockResolvedValue(fakePresale);
      Contribution.findAll.mockResolvedValue([]);
      Crypto.getBySymbol.mockResolvedValue({ id: 'usdt-uuid' });
      Contribution.create.mockResolvedValue({ toJSON: () => ({ id: 'cont-1' }) });

      const reqMock = {};
      const finalizeMock = jest.fn();

      await buy({
        userId: 'user-1',
        presaleId: 'presale-1',
        amountUsdt: '50',
        idempotencyKey: 'idemp-key',
        req: reqMock,
        finalizeInTransaction: finalizeMock
      });

      expect(Presale.findByPk).toHaveBeenCalled();
      expect(fakePresale.update).toHaveBeenCalledWith(
        { totalRaisedUsdt: '150' },
        expect.any(Object)
      );

      // 50 / 2 = 25 tokens
      expect(Contribution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          presaleId: 'presale-1',
          userId: 'user-1',
          amountUsdt: '50',
          tokenAmount: '25',
          reference: 'idemp-key'
        }),
        expect.any(Object)
      );

      expect(postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'launchpad_buy',
          reference: 'idemp-key',
          lines: [
            { ownerId: 'user-1', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'usdt-uuid', amount: money.negate('50') },
            { ownerId: null, purpose: PURPOSES.SUSPENSE, cryptoId: 'usdt-uuid', amount: '50' }
          ]
        }),
        expect.any(Object)
      );

      expect(finalizeMock).toHaveBeenCalledWith(reqMock, expect.any(Object), 200, { id: 'cont-1' });
    });

    it('throws if presale is not active', async () => {
      const now = new Date();
      Presale.findByPk.mockResolvedValue({
        status: 'PENDING',
        startDate: new Date(now.getTime() - 10000),
        endDate: new Date(now.getTime() + 10000),
      });

      await expect(buy({ amountUsdt: '50' })).rejects.toThrow('Presale is not active');
    });
  });

  describe('resolvePresale', () => {
    it('credits tokens to buyers if soft cap is met', async () => {
      const fakePresale = {
        id: 'p1',
        tokenCryptoId: 'token-uuid',
        totalRaisedUsdt: '600',
        softCapUsdt: '500',
        status: 'ACTIVE',
        update: jest.fn()
      };

      Presale.findByPk.mockResolvedValue(fakePresale);
      Contribution.findAll.mockResolvedValue([
        { userId: 'u1', amountUsdt: '100', tokenAmount: '50' },
        { userId: 'u2', amountUsdt: '200', tokenAmount: '100' }
      ]);
      Crypto.getBySymbol.mockResolvedValue({ id: 'usdt-uuid' });

      await resolvePresale({ presaleId: 'p1' });

      expect(fakePresale.update).toHaveBeenCalledWith(
        { status: 'RESOLVED_SUCCESS' },
        expect.any(Object)
      );

      // Post transaction for tokens
      expect(postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'launchpad_resolve_tokens',
          lines: expect.arrayContaining([
            { ownerId: null, purpose: PURPOSES.TREASURY, cryptoId: 'token-uuid', amount: money.negate('50') },
            { ownerId: 'u1', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'token-uuid', amount: '50' },
            { ownerId: null, purpose: PURPOSES.TREASURY, cryptoId: 'token-uuid', amount: money.negate('100') },
            { ownerId: 'u2', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'token-uuid', amount: '100' }
          ])
        }),
        expect.any(Object)
      );

      // Post transaction for USDT
      expect(postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'launchpad_resolve_usdt',
          lines: expect.arrayContaining([
            { ownerId: null, purpose: PURPOSES.SUSPENSE, cryptoId: 'usdt-uuid', amount: money.negate('100') },
            { ownerId: null, purpose: PURPOSES.TREASURY, cryptoId: 'usdt-uuid', amount: '100' }
          ])
        }),
        expect.any(Object)
      );
    });

    it('refunds USDT to buyers if soft cap is not met', async () => {
      const fakePresale = {
        id: 'p1',
        tokenCryptoId: 'token-uuid',
        totalRaisedUsdt: '400',
        softCapUsdt: '500',
        status: 'ACTIVE',
        update: jest.fn()
      };

      Presale.findByPk.mockResolvedValue(fakePresale);
      Contribution.findAll.mockResolvedValue([
        { userId: 'u1', amountUsdt: '400', tokenAmount: '200' }
      ]);
      Crypto.getBySymbol.mockResolvedValue({ id: 'usdt-uuid' });

      await resolvePresale({ presaleId: 'p1' });

      expect(fakePresale.update).toHaveBeenCalledWith(
        { status: 'RESOLVED_FAILED' },
        expect.any(Object)
      );

      expect(postTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'launchpad_refund_usdt',
          lines: expect.arrayContaining([
            { ownerId: null, purpose: PURPOSES.SUSPENSE, cryptoId: 'usdt-uuid', amount: money.negate('400') },
            { ownerId: 'u1', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'usdt-uuid', amount: '400' }
          ])
        }),
        expect.any(Object)
      );
    });
  });
});
