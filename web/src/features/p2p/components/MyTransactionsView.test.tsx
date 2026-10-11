// web/src/features/p2p/components/MyTransactionsView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type { Transaction, MyTxResponse } from '../types';

const onSelect = vi.fn();

vi.mock('../queries', () => ({
  useMyTransactions: vi.fn(),
}));

vi.mock('@/shared/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('@/shared/money', () => ({
  formatDisplay: (v: string) => v,
}));

import { useMyTransactions } from '../queries';
import { MyTransactionsView } from './MyTransactionsView';

// --- fixtures ---

const TX_BUYER_INITIATED: Transaction = {
  id: 'tx1',
  offerId: 'o1',
  buyerId: 'u-buyer',
  sellerId: 'u-seller',
  cryptoId: 'c-btc',
  amount: '0.5',
  unitPrice: '65000',
  fiatAmount: '32500',
  fiatCurrency: 'USD',
  paymentMethodId: 'pm1',
  status: 'initiated',
  paymentConfirmedAt: null,
  completedAt: null,
  created_at: '2026-10-01T12:00:00Z',
  updated_at: '2026-10-01T12:00:00Z',
  crypto: { id: 'c-btc', symbol: 'BTC', name: 'Bitcoin' },
  buyer: { id: 'u-buyer', username: 'alice', averageRating: 4.8 },
  seller: { id: 'u-seller', username: 'bob', averageRating: 4.5 },
  esComprador: true,
};

const TX_SELLER_COMPLETED: Transaction = {
  id: 'tx2',
  offerId: 'o2',
  buyerId: 'u-buyer2',
  sellerId: 'u-seller2',
  cryptoId: 'c-eth',
  amount: '1.2',
  unitPrice: '3000',
  fiatAmount: '3600',
  fiatCurrency: 'EUR',
  paymentMethodId: 'pm2',
  status: 'completed',
  paymentConfirmedAt: '2026-10-02T10:00:00Z',
  completedAt: '2026-10-02T11:00:00Z',
  created_at: '2026-10-02T09:00:00Z',
  updated_at: '2026-10-02T11:00:00Z',
  crypto: { id: 'c-eth', symbol: 'ETH', name: 'Ethereum' },
  buyer: { id: 'u-buyer2', username: 'charlie', averageRating: 4.2 },
  seller: { id: 'u-seller2', username: 'diana', averageRating: 4.9 },
  esComprador: false,
};

const RESPONSE_TWO: MyTxResponse = {
  transacciones: [TX_BUYER_INITIATED, TX_SELLER_COMPLETED],
  total: 2,
  page: 1,
  limit: 20,
};

describe('MyTransactionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSelect.mockReset();
  });

  it('shows loading state', () => {
    (useMyTransactions as any).mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<MyTransactionsView onSelect={onSelect} />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('shows error state', () => {
    (useMyTransactions as any).mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<MyTransactionsView onSelect={onSelect} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert').textContent).toContain('p2p.myTx.error');
  });

  it('shows empty state when no transactions', () => {
    (useMyTransactions as any).mockReturnValue({
      data: { transacciones: [], total: 0, page: 1, limit: 20 },
      isLoading: false,
      isError: false,
    });
    render(<MyTransactionsView onSelect={onSelect} />);
    expect(screen.getByText('p2p.myTx.empty')).toBeInTheDocument();
  });

  it('renders buyer+initiated row: crypto symbol, amount, fiat, status badge, buyer role, counterparty (seller username)', () => {
    (useMyTransactions as any).mockReturnValue({ data: RESPONSE_TWO, isLoading: false, isError: false });
    render(<MyTransactionsView onSelect={onSelect} />);

    // crypto symbol appears at least once (in symbol cell + amount cell)
    expect(screen.getAllByText('BTC').length).toBeGreaterThanOrEqual(1);
    // amount cell contains the amount value (rendered as "0.5 BTC")
    expect(screen.getByText(/^0\.5\s/)).toBeInTheDocument();
    // fiat amount + currency
    expect(screen.getByText(/32500/)).toBeInTheDocument();
    // status badge
    expect(screen.getByText('p2p.status.initiated')).toBeInTheDocument();
    // role chip: buyer
    expect(screen.getByText('p2p.myTx.buyer')).toBeInTheDocument();
    // counterparty = seller.username (since esComprador=true)
    expect(screen.getByText('bob')).toBeInTheDocument();
  });

  it('renders seller+completed row: ETH symbol, status badge, seller role, counterparty (buyer username)', () => {
    (useMyTransactions as any).mockReturnValue({ data: RESPONSE_TWO, isLoading: false, isError: false });
    render(<MyTransactionsView onSelect={onSelect} />);

    // crypto symbol
    expect(screen.getByText('ETH')).toBeInTheDocument();
    // status badge
    expect(screen.getByText('p2p.status.completed')).toBeInTheDocument();
    // role chip: seller
    expect(screen.getByText('p2p.myTx.seller')).toBeInTheDocument();
    // counterparty = buyer.username (since esComprador=false)
    expect(screen.getByText('charlie')).toBeInTheDocument();
  });

  it('clicking a buyer row fires onSelect with that transaction', async () => {
    (useMyTransactions as any).mockReturnValue({ data: RESPONSE_TWO, isLoading: false, isError: false });
    render(<MyTransactionsView onSelect={onSelect} />);

    // Row for tx1 — click the button
    const buttons = screen.getAllByRole('button');
    // First button is tx1 (buyer/initiated)
    await userEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(TX_BUYER_INITIATED);
  });

  it('clicking a seller row fires onSelect with that transaction', async () => {
    (useMyTransactions as any).mockReturnValue({ data: RESPONSE_TWO, isLoading: false, isError: false });
    render(<MyTransactionsView onSelect={onSelect} />);

    const buttons = screen.getAllByRole('button');
    // Second button is tx2 (seller/completed)
    await userEvent.click(buttons[1]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(TX_SELLER_COMPLETED);
  });

  it('falls back to sliced cryptoId when crypto object is absent', () => {
    const noSymbolTx: Transaction = {
      ...TX_BUYER_INITIATED,
      id: 'tx3',
      cryptoId: 'unknown-crypto-xyz',
      crypto: undefined,
    };
    (useMyTransactions as any).mockReturnValue({
      data: { transacciones: [noSymbolTx], total: 1, page: 1, limit: 20 },
      isLoading: false,
      isError: false,
    });
    render(<MyTransactionsView onSelect={onSelect} />);
    expect(screen.getByText('unknown-')).toBeInTheDocument();
  });

  it('pending transactions (initiated/payment_confirmed) carry the pending CSS class on their row', () => {
    const pmConfTx: Transaction = {
      ...TX_BUYER_INITIATED,
      id: 'tx4',
      status: 'payment_confirmed',
    };
    (useMyTransactions as any).mockReturnValue({
      data: { transacciones: [TX_BUYER_INITIATED, pmConfTx], total: 2, page: 1, limit: 20 },
      isLoading: false,
      isError: false,
    });
    render(<MyTransactionsView onSelect={onSelect} />);
    const buttons = screen.getAllByRole('button');
    // Both rows are pending — each button/row should have the pending class
    expect(buttons[0].className).toMatch(/pending/i);
    expect(buttons[1].className).toMatch(/pending/i);
  });
});
