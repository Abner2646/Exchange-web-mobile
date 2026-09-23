const { accrueCommission, claim } = require('./referrals.service');
const { ReferralLink, ReferralBalance } = require('./referrals.model');
const { postTransaction } = require('../balances/ledger/postingService');
const businessConfig = require('../config/businessConfig');
const { PURPOSES } = require('../balances/ledger/ledgerAccounts');
const money = require('../../utils/money');

jest.mock('../../models', () => {
  const transactionMock = jest.fn((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
  return {
    sequelize: {
      transaction: transactionMock,
    },
    Crypto: { getBySymbol: jest.fn() },
    LedgerEntry: { findOne: jest.fn() },
  };
});

const { Crypto, LedgerEntry } = require('../../models');

jest.mock('./referrals.model', () => ({
  ReferralLink: { findOne: jest.fn() },
  ReferralBalance: { findOne: jest.fn(), findOrCreate: jest.fn() },
}));

jest.mock('../balances/ledger/postingService', () => ({
  postTransaction: jest.fn()
}));

jest.mock('../config/businessConfig', () => ({
  getNumber: jest.fn()
}));

describe('Referrals Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('accrueCommission', () => {
    it('calculates commission, accrues to sponsor, and funds the referral liability', async () => {
      businessConfig.getNumber.mockResolvedValue(0.1); // 10%
      ReferralLink.findOne.mockResolvedValue({ sponsorId: 'sponsor-uuid' });
      Crypto.getBySymbol.mockResolvedValue({ id: 'usdt-uuid' });

      const fakeBalance = {
        userId: 'sponsor-uuid',
        saldoReferidosPendienteUsdt: '50',
        update: jest.fn()
      };
      ReferralBalance.findOrCreate.mockResolvedValue([fakeBalance]);

      const commission = await accrueCommission({
        inviteeUserId: 'invitee-uuid',
        feeAmount: '200',
        feeAsset: 'USDT',
        sourceRef: 'trade-42'
      });

      // 200 * 0.1 = 20
      expect(commission).toBe('20');

      // Update with exact math 50 + 20 = 70
      expect(fakeBalance.update).toHaveBeenCalledWith(
        { saldoReferidosPendienteUsdt: '70' },
        expect.any(Object)
      );

      // Liability funded at accrual: FEE_REVENUE -> REFERRAL_LIABILITY (balanced, USDT)
      expect(postTransaction).toHaveBeenCalledWith(
        {
          type: 'referral_accrual',
          reference: 'referral_accrual:trade-42',
          description: 'Devengo de comisión de referidos',
          lines: [
            { ownerId: null, purpose: PURPOSES.FEE_REVENUE, cryptoId: 'usdt-uuid', amount: money.negate('20') },
            { ownerId: null, purpose: PURPOSES.REFERRAL_LIABILITY, cryptoId: 'usdt-uuid', amount: '20' }
          ]
        },
        expect.any(Object)
      );
    });

    it('returns null if commission is zero', async () => {
      businessConfig.getNumber.mockResolvedValue(0.1);
      const commission = await accrueCommission({
        inviteeUserId: 'invitee-uuid',
        feeAmount: '0',
        feeAsset: 'USDT'
      });
      expect(commission).toBeNull();
      expect(ReferralLink.findOne).not.toHaveBeenCalled();
    });

    it('returns null if user is not referred', async () => {
      businessConfig.getNumber.mockResolvedValue(0.1);
      ReferralLink.findOne.mockResolvedValue(null);
      const commission = await accrueCommission({
        inviteeUserId: 'invitee-uuid',
        feeAmount: '20',
        feeAsset: 'USDT'
      });
      expect(commission).toBeNull();
    });

    it('requires a sourceRef when there is a real commission to accrue (no random-UUID fallback that defeats dedup)', async () => {
      businessConfig.getNumber.mockResolvedValue(0.1);
      ReferralLink.findOne.mockResolvedValue({ sponsorId: 'sponsor-uuid' });

      await expect(accrueCommission({
        inviteeUserId: 'invitee-uuid',
        feeAmount: '200',
        feeAsset: 'USDT'
        // sourceRef intentionally omitted
      })).rejects.toThrow(/sourceRef/i);

      // Must not have touched the balance or the ledger.
      expect(ReferralBalance.findOrCreate).not.toHaveBeenCalled();
      expect(postTransaction).not.toHaveBeenCalled();
    });

    it('is idempotent: if the accrual entry already exists it does NOT re-increment the balance (prevents balance/ledger divergence)', async () => {
      businessConfig.getNumber.mockResolvedValue(0.1);
      ReferralLink.findOne.mockResolvedValue({ sponsorId: 'sponsor-uuid' });
      Crypto.getBySymbol.mockResolvedValue({ id: 'usdt-uuid' });
      LedgerEntry.findOne.mockResolvedValue({ id: 'existing-entry', reference: 'referral_accrual:trade-42' });

      const result = await accrueCommission({
        inviteeUserId: 'invitee-uuid',
        feeAmount: '200',
        feeAsset: 'USDT',
        sourceRef: 'trade-42'
      });

      expect(result).toBeNull();
      // Critical: the per-user balance must NOT be mutated on a retry, and no second ledger post.
      expect(ReferralBalance.findOrCreate).not.toHaveBeenCalled();
      expect(postTransaction).not.toHaveBeenCalled();
    });

    it('does not pay a commission on a self-referral (sponsor === invitee)', async () => {
      businessConfig.getNumber.mockResolvedValue(0.1);
      ReferralLink.findOne.mockResolvedValue({ sponsorId: 'invitee-uuid' });

      const result = await accrueCommission({
        inviteeUserId: 'invitee-uuid',
        feeAmount: '200',
        feeAsset: 'USDT',
        sourceRef: 'trade-99'
      });

      expect(result).toBeNull();
      expect(ReferralBalance.findOrCreate).not.toHaveBeenCalled();
      expect(postTransaction).not.toHaveBeenCalled();
    });
  });

  describe('claim', () => {
    it('throws if there is no pending balance', async () => {
      ReferralBalance.findOne.mockResolvedValue(null);
      
      await expect(claim({ userId: 'sponsor-1', reference: 'ref-1' }))
        .rejects.toThrow('No hay balance de referidos pendiente');
    });

    it('atomically zeroes balance and calls postTransaction', async () => {
      const fakeBalance = {
        userId: 'sponsor-1',
        saldoReferidosPendienteUsdt: '25.5',
        update: jest.fn()
      };
      ReferralBalance.findOne.mockResolvedValue(fakeBalance);
      Crypto.getBySymbol.mockResolvedValue({ id: 'usdt-uuid' });

      const result = await claim({ userId: 'sponsor-1', reference: 'ref-1' });

      expect(result.amountClaimed).toBe('25.5');
      
      // 1. Zero out balance
      expect(fakeBalance.update).toHaveBeenCalledWith(
        { saldoReferidosPendienteUsdt: '0' },
        expect.any(Object)
      );

      // 2. Ledger movement from REFERRAL_LIABILITY to FUNDING_AVAILABLE
      expect(postTransaction).toHaveBeenCalledWith(
        {
          type: 'referral_claim',
          reference: 'ref-1',
          description: 'Reclamo de comisiones de referidos',
          lines: [
            { ownerId: null, purpose: PURPOSES.REFERRAL_LIABILITY, cryptoId: 'usdt-uuid', amount: money.negate('25.5') },
            { ownerId: 'sponsor-1', purpose: PURPOSES.FUNDING_AVAILABLE, cryptoId: 'usdt-uuid', amount: '25.5' }
          ]
        },
        expect.any(Object)
      );
    });
  });
});
