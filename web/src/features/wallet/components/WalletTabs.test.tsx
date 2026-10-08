// web/src/features/wallet/components/WalletTabs.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';

vi.mock('../queries', () => ({
  useMyBalances: () => ({ data: [], isLoading: false, isError: false }),
  useTransactionHistory: () => ({ data: [], isLoading: false, isError: false }),
  useDepositAddress: () => ({ data: undefined, isLoading: false, isError: false, error: null }),
  useCompartmentTransfer: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null }),
  useWithdraw: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false, error: null, isSuccess: false }),
}));

import WalletTabs from './WalletTabs';

function setup() {
  return render(<LocaleProvider><WalletTabs /></LocaleProvider>);
}

describe('WalletTabs', () => {
  it('shows balances by default and switches to withdraw', () => {
    setup();
    expect(screen.getByText('You have no balances yet.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Withdraw|Retirar/i }));
    expect(screen.getByRole('heading', { name: /Withdraw|Retirar/i })).toBeInTheDocument();
  });
});
