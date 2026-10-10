// web/src/features/trading/components/MyOrdersView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const cancelMutate = vi.fn();
vi.mock('../queries', () => ({
  useActiveOrders: vi.fn(),
  useCancelOrder: vi.fn(() => ({ mutate: cancelMutate, isPending: false })),
  usePairs: vi.fn(() => ({ data: [{ id: 'p1', symbol: 'BTC/USDT' }] })),
}));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
vi.mock('@/shared/i18n/errorCatalog', () => ({ useErrorTranslation: () => ({ tError: (c: string) => c }) }));
import { useActiveOrders } from '../queries';
import MyOrdersView from './MyOrdersView';

describe('MyOrdersView', () => {
  beforeEach(() => vi.clearAllMocks());
  it('shows empty state', () => {
    (useActiveOrders as any).mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<MyOrdersView />);
    expect(screen.getByText('trading.orders.empty')).toBeInTheDocument();
  });
  it('renders an order row and cancels', async () => {
    (useActiveOrders as any).mockReturnValue({
      data: [{ id: 'o1', tradingPairId: 'p1', orderType: 'limit', side: 'buy', quantity: '0.5', quantityRemaining: '0.5', price: '64000', status: 'open', feePercent: '0.1', feeCurrency: 'BTC' }],
      isLoading: false, isError: false,
    });
    render(<MyOrdersView />);
    expect(screen.getByText('BTC/USDT')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'trading.orders.cancel' }));
    expect(cancelMutate).toHaveBeenCalledWith('o1');
  });
});
