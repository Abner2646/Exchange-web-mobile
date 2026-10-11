// web/src/features/p2p/components/OfferDetail.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type { Offer, CryptoRef } from '../types';

vi.mock('../queries', () => ({
  useActiveOffers: vi.fn(),
  useCryptoCatalog: vi.fn(() => ({
    data: [{ id: 'c1', symbol: 'BTC', name: 'Bitcoin' }] as CryptoRef[],
  })),
  usePaymentMethods: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/shared/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('@/shared/money', () => ({
  formatDisplay: (v: string) => v,
}));

vi.mock('@/shared/ui', () => ({
  Button: ({
    children,
    onClick,
    type,
    disabled,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button type={type} onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

import { OfferDetail } from './OfferDetail';

const SELL_OFFER: Offer = {
  id: 'o1',
  userId: 'u1',
  type: 'sell',
  cryptoId: 'c1',
  minAmount: '0.01',
  maxAmount: '0.5',
  unitPrice: '65000',
  fiatCurrency: 'USD',
  additionalTerms: 'Pay via Zelle only.',
  active: true,
  direccionFiat: 'seller@paypal.com',
  paymentMethods: [{ id: 'pm1', name: 'PayPal', description: null, active: true }],
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

const BUY_OFFER: Offer = {
  id: 'o2',
  userId: 'u2',
  type: 'buy',
  cryptoId: 'c1',
  minAmount: '0.1',
  maxAmount: '1',
  unitPrice: '64500',
  fiatCurrency: 'USD',
  additionalTerms: null,
  active: true,
  direccionFiat: null,
  paymentMethods: [{ id: 'pm2', name: 'Bank transfer', description: null, active: true }],
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

const INACTIVE_OFFER: Offer = {
  ...SELL_OFFER,
  id: 'o3',
  active: false,
};

describe('OfferDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders offer meta: type, symbol, price, fiatCurrency, range', () => {
    render(<OfferDetail offer={SELL_OFFER} />);
    // type label key
    expect(screen.getByText('p2p.offers.typeSell')).toBeInTheDocument();
    // resolved symbol
    expect(screen.getByText('BTC')).toBeInTheDocument();
    // price and currency
    expect(screen.getByText(/65000/)).toBeInTheDocument();
    expect(screen.getByText(/USD/)).toBeInTheDocument();
    // range
    expect(screen.getByText(/0\.01/)).toBeInTheDocument();
    expect(screen.getByText(/0\.5/)).toBeInTheDocument();
  });

  it('renders payment method names', () => {
    render(<OfferDetail offer={SELL_OFFER} />);
    expect(screen.getByText('PayPal')).toBeInTheDocument();
  });

  it('renders additionalTerms when present', () => {
    render(<OfferDetail offer={SELL_OFFER} />);
    expect(screen.getByText('Pay via Zelle only.')).toBeInTheDocument();
  });

  it('does NOT render additionalTerms section when null', () => {
    render(<OfferDetail offer={BUY_OFFER} />);
    // the terms label key should not appear when there are no terms
    expect(screen.queryByText('p2p.offers.terms')).not.toBeInTheDocument();
  });

  it('SELL offer renders direccionFiat', () => {
    render(<OfferDetail offer={SELL_OFFER} />);
    expect(screen.getByText('seller@paypal.com')).toBeInTheDocument();
  });

  it('BUY offer does NOT render direccionFiat', () => {
    render(<OfferDetail offer={BUY_OFFER} />);
    // direccionFiat is null and type is buy — address block must not appear
    expect(screen.queryByText('p2p.detail.sellerAddress')).not.toBeInTheDocument();
  });

  it('active offer shows an enabled Accept button', () => {
    const onAccept = vi.fn();
    render(<OfferDetail offer={SELL_OFFER} onAccept={onAccept} />);
    const btn = screen.getByRole('button', { name: 'p2p.offers.accept' });
    expect(btn).not.toBeDisabled();
  });

  it('inactive offer hides or disables the Accept button', () => {
    const onAccept = vi.fn();
    render(<OfferDetail offer={INACTIVE_OFFER} onAccept={onAccept} />);
    // Button must be either absent or disabled
    const btn = screen.queryByRole('button', { name: 'p2p.offers.accept' });
    if (btn) {
      expect(btn).toBeDisabled();
    } else {
      // hidden is also acceptable
      expect(btn).toBeNull();
    }
  });

  it('clicking Accept calls onAccept for an active offer', async () => {
    const onAccept = vi.fn();
    render(<OfferDetail offer={SELL_OFFER} onAccept={onAccept} />);
    const btn = screen.getByRole('button', { name: 'p2p.offers.accept' });
    await userEvent.click(btn);
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('Accept button is absent when onAccept prop is not provided', () => {
    render(<OfferDetail offer={SELL_OFFER} />);
    expect(screen.queryByRole('button', { name: 'p2p.offers.accept' })).toBeNull();
  });

  it('falls back to short cryptoId slice when symbol not in catalog', () => {
    const unknownOffer: Offer = { ...SELL_OFFER, cryptoId: 'unknown-crypto-xyz' };
    render(<OfferDetail offer={unknownOffer} />);
    expect(screen.getByText('unknown-')).toBeInTheDocument();
  });
});
