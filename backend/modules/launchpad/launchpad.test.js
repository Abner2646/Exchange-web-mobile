const {
  buy, resolvePresale, createPresale, activatePresale,
  settlePresaleExecutor, register, HELD_STATUS, DUAL_CONTROL_ACTION,
} = require('./launchpad.service');
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
    Crypto: { getBySymbol: jest.fn(), findByPk: jest.fn() }
  };
});

jest.mock('./launchpad.model', () => ({
  Presale: { findByPk: jest.fn(), create: jest.fn(), update: jest.fn() },
  Contribution: { findAll: jest.fn(), create: jest.fn() }
}));

jest.mock('../balances/ledger/postingService', () => ({
  postTransaction: jest.fn()
}));

// Mock the pending-action model so the REAL makerChecker.service loads (we exercise its real
// requiresDualControl + propose) without touching a database.
jest.mock('../governance/governance.model', () => ({
  PendingAdminAction: { create: jest.fn(), findByPk: jest.fn(), update: jest.fn() }
}));

// businessConfig is DB-backed; return the provided default for every key (threshold=20000, ttl=24).
jest.mock('../config/businessConfig', () => ({
  getNumber: jest.fn((key, def) => Promise.resolve(def)),
  getBoolean: jest.fn((key, def) => Promise.resolve(def)),
}));

const { PendingAdminAction } = require('../governance/governance.model');

describe('Launchpad Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buy', () => {
    const activePresaleWith = (overrides = {}) => {
      const now = new Date();
      return {
        id: 'presale-1', tokenCryptoId: 'token-uuid', priceUsdt: '2',
        hardCapUsdt: '1000', softCapUsdt: '500', minTicketUsdt: '0', maxTicketUsdt: '100',
        startDate: new Date(now.getTime() - 10000), endDate: new Date(now.getTime() + 10000),
        status: 'ACTIVE', totalRaisedUsdt: '100', update: jest.fn(), ...overrides,
      };
    };

    it('rejects a negative amount even if min ticket is misconfigured to 0 (prevents minting)', async () => {
      Presale.findByPk.mockResolvedValue(activePresaleWith());
      await expect(buy({ userId: 'u', presaleId: 'presale-1', amountUsdt: '-100', idempotencyKey: 'k' }))
        .rejects.toThrow(/positive/i);
      expect(Contribution.create).not.toHaveBeenCalled();
      expect(postTransaction).not.toHaveBeenCalled();
    });

    it('rejects a zero amount', async () => {
      Presale.findByPk.mockResolvedValue(activePresaleWith());
      await expect(buy({ userId: 'u', presaleId: 'presale-1', amountUsdt: '0', idempotencyKey: 'k' }))
        .rejects.toThrow(/positive/i);
      expect(postTransaction).not.toHaveBeenCalled();
    });

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

  describe('resolvePresale — dual control parity with large withdrawals', () => {
    const heldPresale = (overrides = {}) => ({
      id: 'p-big',
      tokenCryptoId: 'token-uuid',
      totalRaisedUsdt: '25000', // above the $20k default threshold / hard ceiling
      softCapUsdt: '500',
      status: 'ACTIVE',
      update: jest.fn(),
      ...overrides,
    });

    it('HOLDS a large resolution and proposes a Maker-Checker action instead of settling', async () => {
      const presale = heldPresale();
      Presale.findByPk.mockResolvedValue(presale);
      PendingAdminAction.create.mockResolvedValue({ id: 'action-99' });

      const result = await resolvePresale({ presaleId: 'p-big', makerUserId: 'op-1' });

      expect(result.pending).toBe(true);
      // Presale is held, NOT settled.
      expect(presale.update).toHaveBeenCalledWith({ status: HELD_STATUS }, expect.any(Object));
      expect(postTransaction).not.toHaveBeenCalled();
      // A pending action was proposed with the server-computed USD magnitude and the maker.
      expect(PendingAdminAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: DUAL_CONTROL_ACTION,
          amountUsd: '25000',
          makerUserId: 'op-1',
          payload: { presaleId: 'p-big' },
        }),
        expect.any(Object)
      );
    });

    it('refuses a large resolution with no maker (cannot propose without an operator)', async () => {
      Presale.findByPk.mockResolvedValue(heldPresale());
      await expect(resolvePresale({ presaleId: 'p-big' })).rejects.toThrow(/maker|operador/i);
      expect(postTransaction).not.toHaveBeenCalled();
    });

    it('settles a SMALL resolution immediately (below threshold, no 4-eyes)', async () => {
      const presale = heldPresale({ totalRaisedUsdt: '600' });
      Presale.findByPk.mockResolvedValue(presale);
      Contribution.findAll.mockResolvedValue([{ userId: 'u1', amountUsdt: '600', tokenAmount: '300' }]);
      Crypto.getBySymbol.mockResolvedValue({ id: 'usdt-uuid' });

      const result = await resolvePresale({ presaleId: 'p-small', makerUserId: 'op-1' });

      expect(result.pending).toBe(false);
      expect(PendingAdminAction.create).not.toHaveBeenCalled();
      expect(presale.update).toHaveBeenCalledWith({ status: 'RESOLVED_SUCCESS' }, expect.any(Object));
    });

    it('executor settles a HELD presale on checker approval', async () => {
      const presale = heldPresale({ status: HELD_STATUS });
      Presale.findByPk.mockResolvedValue(presale);
      Contribution.findAll.mockResolvedValue([{ userId: 'u1', amountUsdt: '25000', tokenAmount: '12500' }]);
      Crypto.getBySymbol.mockResolvedValue({ id: 'usdt-uuid' });
      const tx = { LOCK: { UPDATE: 'UPDATE' } };

      const out = await settlePresaleExecutor({ presaleId: 'p-big' }, tx);

      expect(out.settled).toBe(true);
      expect(presale.update).toHaveBeenCalledWith({ status: 'RESOLVED_SUCCESS' }, expect.any(Object));
      expect(postTransaction).toHaveBeenCalled();
    });

    it('executor THROWS if the presale is not held (anti double-settle / replay)', async () => {
      Presale.findByPk.mockResolvedValue(heldPresale({ status: 'RESOLVED_SUCCESS' }));
      await expect(settlePresaleExecutor({ presaleId: 'p-big' }, { LOCK: { UPDATE: 'UPDATE' } }))
        .rejects.toThrow(/not held/i);
      expect(postTransaction).not.toHaveBeenCalled();
    });

    it('executor THROWS if the presale is gone', async () => {
      Presale.findByPk.mockResolvedValue(null);
      await expect(settlePresaleExecutor({ presaleId: 'missing' }, { LOCK: { UPDATE: 'UPDATE' } }))
        .rejects.toThrow(/no presale/i);
    });

    it('rejects resolving a presale that is already held/resolved (no duplicate proposal)', async () => {
      Presale.findByPk.mockResolvedValue(heldPresale({ status: HELD_STATUS }));
      await expect(resolvePresale({ presaleId: 'p-big', makerUserId: 'op-1' }))
        .rejects.toThrow(/already resolved or pending/i);
      expect(PendingAdminAction.create).not.toHaveBeenCalled();
    });

    it('register() wires the executor into the Maker-Checker engine', () => {
      const makerChecker = require('../governance/makerChecker.service');
      const spy = jest.spyOn(makerChecker, 'registerExecutor');
      register();
      expect(spy).toHaveBeenCalledWith(DUAL_CONTROL_ACTION, expect.any(Function));
      spy.mockRestore();
    });
  });

  describe('createPresale', () => {
    const validInput = {
      tokenCryptoId: 'token-uuid', priceUsdt: '2', hardCapUsdt: '1000', softCapUsdt: '500',
      minTicketUsdt: '10', maxTicketUsdt: '100', startDate: '2026-10-01T00:00:00Z', endDate: '2026-10-10T00:00:00Z'
    };

    it('rejects unknown tokenCryptoId', async () => {
      Crypto.findByPk.mockResolvedValue(null);
      await expect(createPresale(validInput)).rejects.toThrow('Unknown token crypto');
    });

    it('rejects softCap > hardCap', async () => {
      Crypto.findByPk.mockResolvedValue({ id: 'token-uuid' });
      await expect(createPresale({ ...validInput, softCapUsdt: '2000' })).rejects.toThrow('Soft cap cannot exceed hard cap');
    });

    it('rejects minTicket > maxTicket', async () => {
      Crypto.findByPk.mockResolvedValue({ id: 'token-uuid' });
      await expect(createPresale({ ...validInput, minTicketUsdt: '200' })).rejects.toThrow('Min ticket cannot exceed max ticket');
    });

    it('rejects non-positive price', async () => {
      Crypto.findByPk.mockResolvedValue({ id: 'token-uuid' });
      await expect(createPresale({ ...validInput, priceUsdt: '0' })).rejects.toThrow('Price must be positive');
      await expect(createPresale({ ...validInput, priceUsdt: '-1' })).rejects.toThrow('Price must be positive');
    });

    it('rejects start >= end dates', async () => {
      Crypto.findByPk.mockResolvedValue({ id: 'token-uuid' });
      await expect(createPresale({ ...validInput, startDate: '2026-10-10T00:00:00Z', endDate: '2026-10-01T00:00:00Z' })).rejects.toThrow('Invalid date range');
    });

    it('creates a PENDING presale on happy path', async () => {
      Crypto.findByPk.mockResolvedValue({ id: 'token-uuid' });
      Presale.create.mockResolvedValue({ id: 'new-presale' });
      
      const result = await createPresale(validInput);
      
      expect(Presale.create).toHaveBeenCalledWith(expect.objectContaining({
        tokenCryptoId: 'token-uuid',
        priceUsdt: '2',
        hardCapUsdt: '1000',
        softCapUsdt: '500',
        minTicketUsdt: '10',
        maxTicketUsdt: '100',
        status: 'PENDING'
      }));
      expect(result).toEqual({ id: 'new-presale' });
    });
  });

  describe('activatePresale', () => {
    it('returns 404 when missing', async () => {
      Presale.findByPk.mockResolvedValue(null);
      await expect(activatePresale({ presaleId: 'p1' })).rejects.toThrow('Presale not found');
    });

    it('returns 400 when not PENDING', async () => {
      Presale.findByPk.mockResolvedValue({ status: 'ACTIVE' });
      await expect(activatePresale({ presaleId: 'p1' })).rejects.toThrow('Only a pending presale can be activated');
    });

    it('flips PENDING->ACTIVE on happy path', async () => {
      const fakePresale = { status: 'PENDING', update: jest.fn() };
      Presale.findByPk.mockResolvedValue(fakePresale);
      
      const result = await activatePresale({ presaleId: 'p1' });
      
      expect(fakePresale.update).toHaveBeenCalledWith({ status: 'ACTIVE' });
      expect(result).toBe(fakePresale);
    });
  });
});
