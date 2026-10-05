// Unit tests for the referral commission consumer. It reacts to the SwapExecuted
// money event (OUT of the swap hot-path) and accrues the invitee's sponsor
// commission, valuing the swap fee (charged in the quote asset) in USD≈USDT.
// Dependencies are injected so there is no DB/network.
jest.mock('./referrals.service', () => ({ accrueCommission: jest.fn() }));
jest.mock('./referrals.model', () => ({ ReferralLink: { findOne: jest.fn() } }));
jest.mock('../aml/amlValuation', () => ({ getUsdValue: jest.fn() }));
jest.mock('../../models', () => ({ SwapPair: { findByPk: jest.fn() } }));

const referrals = require('./referrals.service');
const { ReferralLink } = require('./referrals.model');
const amlValuation = require('../aml/amlValuation');
const { SwapPair } = require('../../models');
const consumer = require('./referralsConsumer');

const SWAP_EVENT = {
  id: 'evt-1',
  type: 'SwapExecuted',
  payload: {
    swapId: 'swap-1',
    userId: 'invitee-1',
    pairId: 'pair-1',
    type: 'buy',
    feeAmount: '2',
  },
};

describe('referralsConsumer.handleSwapExecuted', () => {
  afterEach(() => jest.clearAllMocks());

  it('accrues commission valuing the fee in USD when the buyer has a sponsor link', async () => {
    ReferralLink.findOne.mockResolvedValue({ sponsorId: 'sponsor-1', inviteeId: 'invitee-1' });
    SwapPair.findByPk.mockResolvedValue({ quoteCryptoId: 'usdt-id' });
    amlValuation.getUsdValue.mockResolvedValue({ usd: '2', source: 'stable' });

    await consumer.handleSwapExecuted(SWAP_EVENT);

    expect(amlValuation.getUsdValue).toHaveBeenCalledWith('usdt-id', '2');
    expect(referrals.accrueCommission).toHaveBeenCalledWith({
      inviteeUserId: 'invitee-1',
      feeUsdtEquivalent: '2',
      sourceRef: 'swap:swap-1',
    });
  });

  it('is a cheap no-op when the invitee has no sponsor link (no valuation work)', async () => {
    ReferralLink.findOne.mockResolvedValue(null);

    await consumer.handleSwapExecuted(SWAP_EVENT);

    expect(amlValuation.getUsdValue).not.toHaveBeenCalled();
    expect(referrals.accrueCommission).not.toHaveBeenCalled();
  });

  it('skips accrual when the fee cannot be valued (never accrue a wrong amount)', async () => {
    ReferralLink.findOne.mockResolvedValue({ sponsorId: 'sponsor-1', inviteeId: 'invitee-1' });
    SwapPair.findByPk.mockResolvedValue({ quoteCryptoId: 'weird-id' });
    amlValuation.getUsdValue.mockResolvedValue({ usd: null, source: 'unknown' });

    await consumer.handleSwapExecuted(SWAP_EVENT);

    expect(referrals.accrueCommission).not.toHaveBeenCalled();
  });

  it('ignores a swap with no / non-positive fee', async () => {
    await consumer.handleSwapExecuted({ ...SWAP_EVENT, payload: { ...SWAP_EVENT.payload, feeAmount: '0' } });
    expect(ReferralLink.findOne).not.toHaveBeenCalled();
    expect(referrals.accrueCommission).not.toHaveBeenCalled();
  });

  it('registers itself on the SwapExecuted event', () => {
    const on = jest.fn();
    consumer.register({ on });
    expect(on).toHaveBeenCalledWith('SwapExecuted', 'referrals', expect.any(Function));
  });
});
