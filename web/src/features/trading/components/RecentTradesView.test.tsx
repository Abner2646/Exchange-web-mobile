// web/src/features/trading/components/RecentTradesView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
vi.mock('../queries', () => ({ useRecentTrades: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import { useRecentTrades } from '../queries';
import { RecentTradesView } from './RecentTradesView';

describe('RecentTradesView', () => {
  beforeEach(() => vi.clearAllMocks());
  it('renders a trade row', () => {
    (useRecentTrades as any).mockReturnValue({ data: [{ id: 't1', price: 64500, quantity: 0.5, side: 'buy' }], isLoading: false, isError: false });
    render(<RecentTradesView tradingPairId="p1" />);
    expect(screen.getByText('trading.trades.title')).toBeInTheDocument();
  });
  it('renders empty state', () => {
    (useRecentTrades as any).mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<RecentTradesView tradingPairId="p1" />);
    expect(screen.getByText('trading.trades.empty')).toBeInTheDocument();
  });
});
