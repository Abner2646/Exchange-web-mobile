// web/src/features/p2p/components/OffersList.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type { Offer, CryptoRef } from '../types';

const onSelectOffer = vi.fn();

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
  Button: ({ children, onClick, type, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button type={type} onClick={onClick} {...rest}>{children}</button>
  ),
}));

import { useActiveOffers } from '../queries';
import { OffersList } from './OffersList';

const SELL_OFFER: Offer = {
  id: 'o1',
  userId: 'u1',
  type: 'sell',
  cryptoId: 'c1',
  minAmount: '0.01',
  maxAmount: '0.5',
  unitPrice: '65000',
  fiatCurrency: 'USD',
  additionalTerms: 'Pay via Zelle',
  active: true,
  direccionFiat: 'test@example.com',
  paymentMethods: [{ id: 'pm1', name: 'Zelle', description: null, active: true }],
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

describe('OffersList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSelectOffer.mockReset();
  });

  it('shows loading state', () => {
    (useActiveOffers as any).mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<OffersList onSelectOffer={onSelectOffer} />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('shows error state when query errors', () => {
    (useActiveOffers as any).mockReturnValue({ data: undefined, isLoading: false, isError: true, error: {} });
    render(<OffersList onSelectOffer={onSelectOffer} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert').textContent).toContain('p2p.offers.error');
  });

  it('shows empty state when no offers match the active tab', () => {
    (useActiveOffers as any).mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<OffersList onSelectOffer={onSelectOffer} />);
    expect(screen.getByText('p2p.offers.empty')).toBeInTheDocument();
  });

  it('renders a sell offer row with resolved symbol, price, and range', () => {
    // Default tab is 'sell', so sell offer is visible immediately
    (useActiveOffers as any).mockReturnValue({ data: [SELL_OFFER], isLoading: false, isError: false });
    render(<OffersList onSelectOffer={onSelectOffer} />);

    // symbol resolved from catalog — appears in both the filter option and the table cell
    expect(screen.getAllByText('BTC').length).toBeGreaterThanOrEqual(1);
    // price cell contains "65000 USD"
    expect(screen.getByText(/65000/)).toBeInTheDocument();
    // payment method name
    expect(screen.getByText('Zelle')).toBeInTheDocument();
  });

  it('clicking the accept button calls onSelectOffer with the offer', async () => {
    // Default tab is 'sell', SELL_OFFER is immediately visible
    (useActiveOffers as any).mockReturnValue({ data: [SELL_OFFER], isLoading: false, isError: false });
    render(<OffersList onSelectOffer={onSelectOffer} />);

    const acceptBtn = screen.getByRole('button', { name: 'p2p.offers.accept' });
    await userEvent.click(acceptBtn);
    expect(onSelectOffer).toHaveBeenCalledWith(SELL_OFFER);
  });

  it('buy/sell tab toggle changes which rows are visible', async () => {
    (useActiveOffers as any).mockReturnValue({ data: [SELL_OFFER, BUY_OFFER], isLoading: false, isError: false });
    render(<OffersList onSelectOffer={onSelectOffer} />);

    // Default tab is "sell" — only sell offer visible
    expect(screen.getAllByRole('button', { name: 'p2p.offers.accept' })).toHaveLength(1);
    expect(screen.getByText('Zelle')).toBeInTheDocument();
    expect(screen.queryByText('Bank transfer')).not.toBeInTheDocument();

    // Switch to buy tab via the tab role button
    await userEvent.click(screen.getByRole('tab', { name: 'p2p.offers.typeBuy' }));
    expect(screen.getAllByRole('button', { name: 'p2p.offers.accept' })).toHaveLength(1);
    expect(screen.getByText('Bank transfer')).toBeInTheDocument();
    expect(screen.queryByText('Zelle')).not.toBeInTheDocument();
  });

  it('crypto filter narrows visible offers', async () => {
    const offer2: Offer = {
      ...SELL_OFFER,
      id: 'o3',
      cryptoId: 'c2',
      paymentMethods: [{ id: 'pm3', name: 'PayPal', description: null, active: true }],
    };
    (useActiveOffers as any).mockReturnValue({ data: [SELL_OFFER, offer2], isLoading: false, isError: false });
    render(<OffersList onSelectOffer={onSelectOffer} />);

    // Default tab is 'sell' — both sell offers visible
    expect(screen.getByText('Zelle')).toBeInTheDocument();
    expect(screen.getByText('PayPal')).toBeInTheDocument();

    // Select crypto filter for c1
    const select = screen.getByLabelText('p2p.offers.filterByCrypto');
    await userEvent.selectOptions(select, 'c1');
    expect(screen.getByText('Zelle')).toBeInTheDocument();
    expect(screen.queryByText('PayPal')).not.toBeInTheDocument();
  });

  it('falls back to short cryptoId slice when symbol not in catalog', () => {
    const unknownOffer: Offer = {
      ...SELL_OFFER,
      id: 'o4',
      cryptoId: 'unknown-crypto-xyz',
    };
    (useActiveOffers as any).mockReturnValue({ data: [unknownOffer], isLoading: false, isError: false });
    render(<OffersList onSelectOffer={onSelectOffer} />);
    // Default tab is 'sell' — visible immediately; fallback: first 8 chars of id
    // 'unknown-' appears in the filter option AND the table cell
    expect(screen.getAllByText('unknown-').length).toBeGreaterThanOrEqual(1);
  });
});
