// web/src/features/wallet/components/HistoryView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import HistoryView from './HistoryView';

const useTransactionHistory = vi.fn();
vi.mock('../queries', () => ({ useTransactionHistory: (p: unknown) => useTransactionHistory(p) }));

beforeEach(() => {
  useTransactionHistory.mockReturnValue({
    data: [
      { id: 't1', type: 'withdrawal', status: 'pending', amount: '0.5', confirmations: 0, requiredConfirmations: 6, createdAt: '2026-10-08T00:00:00Z', cryptoId: 'c1', userId: 'u1' },
    ],
    isLoading: false, isError: false,
  });
});

function setup() {
  return render(<LocaleProvider><HistoryView /></LocaleProvider>);
}

describe('HistoryView', () => {
  it('renders a transaction row with its status', () => {
    setup();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
    // "withdrawal" appears in both the filter <option> ("Withdrawals") and the row <td>;
    // use getAllByText to handle both matches.
    expect(screen.getAllByText(/withdrawal/i).length).toBeGreaterThan(0);
  });

  it('changing the filter re-queries with a type param', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Type|Tipo/i), { target: { value: 'deposit' } });
    expect(useTransactionHistory).toHaveBeenLastCalledWith({ type: 'deposit' });
  });
});
