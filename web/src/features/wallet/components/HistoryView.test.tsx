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
    // "withdrawal" appears in BOTH the filter <option> ("Withdrawals") and the row <td>
    // ("withdrawal"); require >= 2 so the assertion fails if the row cell is missing.
    expect(screen.getAllByText(/withdrawal/i).length).toBeGreaterThanOrEqual(2);
  });

  it('changing the filter re-queries with a type param', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Type|Tipo/i), { target: { value: 'deposit' } });
    expect(useTransactionHistory).toHaveBeenLastCalledWith({ type: 'deposit' });
  });

  it('shows a dedicated error message (not the empty state) when the query errors', () => {
    useTransactionHistory.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    setup();
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // Error copy must differ from the empty-state copy.
    expect(alert.textContent).not.toMatch(/no transactions yet|todavía no hay transacciones/i);
    // No data table rendered on error.
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
