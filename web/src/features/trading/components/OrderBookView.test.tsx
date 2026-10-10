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
  it('renders bids and asks', () => {
    (useOrderBook as any).mockReturnValue({ data: { bids: [{ price: 64000, quantity: 1, total: 64000, orders: 2 }], asks: [{ price: 65000, quantity: 2, total: 130000, orders: 1 }], timestamp: '' }, isLoading: false, isError: false });
    render(<OrderBookView tradingPairId="p1" />);
    expect(screen.getByText('trading.book.bids')).toBeInTheDocument();
    expect(screen.getByText('trading.book.asks')).toBeInTheDocument();
  });
  it('renders empty state', () => {
    (useOrderBook as any).mockReturnValue({ data: { bids: [], asks: [], timestamp: '' }, isLoading: false, isError: false });
    render(<OrderBookView tradingPairId="p1" />);
    expect(screen.getByText('trading.book.empty')).toBeInTheDocument();
  });
});
