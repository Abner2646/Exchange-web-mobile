// web/src/features/wallet/components/BalancesView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import BalancesView from './BalancesView';

const useMyBalances = vi.fn();
vi.mock('../queries', () => ({ useMyBalances: () => useMyBalances() }));

function renderView() {
  return render(
    <LocaleProvider>
      <BalancesView />
    </LocaleProvider>,
  );
}

describe('BalancesView', () => {
  it('renders the per-compartment breakdown for each asset', () => {
    useMyBalances.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          userId: 'u1', criptomonedaId: 'c1',
          availableBalance: '500', blockedBalance: '0', pendingBalance: '10',
          compartments: {
            funding: { available: '300', blocked: '0', pending: '10' },
            spot: { available: '200', blocked: '0' },
          },
          crypto: { id: 'c1', symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', decimals: 8 },
        },
      ],
    });
    renderView();
    expect(screen.getByText('BTC')).toBeInTheDocument();
    // Funding available 300 and Spot available 200 both shown.
    expect(screen.getByText(/300/)).toBeInTheDocument();
    expect(screen.getByText(/200/)).toBeInTheDocument();
    // Audit guard: pending (10) is shown separately and flagged non-spendable.
    expect(screen.getByText(/10/)).toBeInTheDocument();
    expect(screen.getByText(/not spendable/i)).toBeInTheDocument();
  });

  it('shows the empty state when there are no balances', () => {
    useMyBalances.mockReturnValue({ isLoading: false, isError: false, data: [] });
    renderView();
    expect(screen.getByText('You have no balances yet.')).toBeInTheDocument();
  });
});
