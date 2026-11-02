// web/src/features/trading/components/OrderBookView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
vi.mock('../queries', () => ({ useOrderBook: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import { useOrderBook } from '../queries';
import { OrderBookView } from './OrderBookView';

describe('OrderBookView', () => {
  beforeEach(() => vi.clearAllMocks());
  it('renders bid and ask prices with a (non-negative) spread', () => {
    (useOrderBook as any).mockReturnValue({ data: { bids: [{ price: 64000, quantity: 1, total: 64000, orders: 2 }], asks: [{ price: 65000, quantity: 2, total: 130000, orders: 1 }], timestamp: '' }, isLoading: false, isError: false });
    render(<OrderBookView tradingPairId="p1" />);
    expect(screen.getByText('trading.book.title')).toBeInTheDocument();
    // 64,000 is both the bid price and its cumulative total → appears more than once.
    expect(screen.getAllByText('64,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('65,000')).toBeInTheDocument();
    // Spread = |65000 - 64000| = 1,000 (guarded against a crossed book).
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('shows a dedicated error state (not empty) when the book query errors', () => {
    (useOrderBook as any).mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<OrderBookView tradingPairId="p1" />);
    expect(screen.getByText('trading.book.error')).toBeInTheDocument();
    expect(screen.queryByText('trading.book.empty')).not.toBeInTheDocument();
  });
  it('renders empty state', () => {
    (useOrderBook as any).mockReturnValue({ data: { bids: [], asks: [], timestamp: '' }, isLoading: false, isError: false });
    render(<OrderBookView tradingPairId="p1" />);
    expect(screen.getByText('trading.book.empty')).toBeInTheDocument();
  });
});
