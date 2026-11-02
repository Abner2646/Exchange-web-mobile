// web/src/features/trading/components/OrderForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mutateAsync = vi.fn();
vi.mock('../queries', () => ({
  usePairs: vi.fn(),
  usePlaceOrder: vi.fn(() => ({ mutateAsync, isPending: false, isError: false, isSuccess: false, error: null, data: undefined })),
}));
vi.mock('@/features/wallet/queries', () => ({ useMyBalances: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
vi.mock('@/shared/i18n/errorCatalog', () => ({ useErrorTranslation: () => ({ tError: (c: string) => c }) }));

import { usePairs, usePlaceOrder } from '../queries';
import { useMyBalances } from '@/features/wallet/queries';
import OrderForm from './OrderForm';

const PAIR = { id: 'p1', symbol: 'BTC/USDT', baseAssetId: 'b1', quoteAssetId: 'q1', baseSymbol: 'BTC', quoteSymbol: 'USDT', status: 'active', minOrderAmount: '0.0001', maxOrderAmount: null, pricePrecision: 2, quantityPrecision: 8, makerFeePercent: '0.1', takerFeePercent: '0.1', lastPrice: '65000' };

function spot(available: string, which: 'q1' | 'b1') {
  return [{ criptomonedaId: which, compartments: { funding: { available: '0', blocked: '0', pending: '0' }, spot: { available, blocked: '0' } }, crypto: { id: which, symbol: which === 'q1' ? 'USDT' : 'BTC' } }];
}

beforeEach(() => {
  vi.clearAllMocks();
  (usePairs as any).mockReturnValue({ data: [PAIR], isLoading: false });
});

// The pair now comes from a prop (single selector lives in the widget).
describe('OrderForm (money-path)', () => {
  it('blocks a limit buy when quote Spot is insufficient and shows the fund-Spot prompt', async () => {
    (useMyBalances as any).mockReturnValue({ data: spot('10', 'q1') }); // need 0.5*64000*(1.001)
    render(<OrderForm pairId="p1" />);
    await userEvent.type(screen.getByLabelText('trading.form.quantity'), '0.5');
    await userEvent.type(screen.getByLabelText('trading.form.price'), '64000');
    expect(screen.getByRole('button', { name: 'trading.form.submitBuy' })).toBeDisabled();
    expect(screen.getByText('trading.form.fundSpot')).toBeInTheDocument();
  });

  it('enables + submits a limit buy with canonical strings when quote Spot covers cost+fee', async () => {
    (useMyBalances as any).mockReturnValue({ data: spot('50000', 'q1') });
    mutateAsync.mockResolvedValue({ success: true, order: { id: 'o1' }, message: 'ok' });
    render(<OrderForm pairId="p1" />);
    await userEvent.type(screen.getByLabelText('trading.form.quantity'), '0.5');
    await userEvent.type(screen.getByLabelText('trading.form.price'), '64000');
    const btn = screen.getByRole('button', { name: 'trading.form.submitBuy' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(mutateAsync).toHaveBeenCalledWith({ tradingPairId: 'p1', orderType: 'limit', side: 'buy', quantity: '0.5', price: '64000' });
  });

  it('sell gate reads the BASE asset Spot balance', async () => {
    (useMyBalances as any).mockReturnValue({ data: spot('0.1', 'b1') }); // have 0.1 BTC, want to sell 0.5
    render(<OrderForm pairId="p1" />);
    // Side is now a segmented button, not a radio.
    await userEvent.click(screen.getByRole('button', { name: 'trading.form.sell' }));
    await userEvent.type(screen.getByLabelText('trading.form.quantity'), '0.5');
    await userEvent.type(screen.getByLabelText('trading.form.price'), '64000');
    expect(screen.getByRole('button', { name: 'trading.form.submitSell' })).toBeDisabled();
  });

  it('shows the pick-a-pair hint when no pair is selected', () => {
    (useMyBalances as any).mockReturnValue({ data: [] });
    render(<OrderForm pairId="" />);
    expect(screen.getByText('trading.form.pickPair')).toBeInTheDocument();
  });
});
