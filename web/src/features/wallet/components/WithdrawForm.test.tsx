// web/src/features/wallet/components/WithdrawForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import WithdrawForm from './WithdrawForm';

const mutateAsync = vi.fn();
const useWithdraw = vi.fn();
const useMyBalances = vi.fn();
vi.mock('../queries', () => ({
  useWithdraw: () => useWithdraw(),
  useMyBalances: () => useMyBalances(),
}));

const BALANCE = [{
  criptomonedaId: 'c1',
  compartments: { funding: { available: '5', blocked: '0', pending: '0' }, spot: { available: '0', blocked: '0' } },
  crypto: { id: 'c1', symbol: 'BTC', network: 'bitcoin' },
}];

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue({ id: 't1', status: 'pending', type: 'withdrawal' });
  useWithdraw.mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null, isSuccess: false });
  useMyBalances.mockReturnValue({ data: BALANCE });
});

function setup() {
  return render(<LocaleProvider><WithdrawForm /></LocaleProvider>);
}

describe('WithdrawForm', () => {
  it('submits {cryptoId,amount,destinationAddress}', async () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Asset|Activo/i), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText(/Amount|Monto/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/address|Dirección/i), { target: { value: 'bc1dest' } });
    fireEvent.click(screen.getByRole('button', { name: /Withdraw|Retirar/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ cryptoId: 'c1', amount: '1', destinationAddress: 'bc1dest' }));
  });

  it('disables submit while pending (no double-submit)', () => {
    useWithdraw.mockReturnValue({ mutateAsync, isPending: true, isError: false, error: null, isSuccess: false });
    setup();
    expect(screen.getByRole('button', { name: /Withdraw|Retirar/i })).toBeDisabled();
  });

  it('shows the coded cooldown error', () => {
    useWithdraw.mockReturnValue({
      mutateAsync, isPending: false, isSuccess: false,
      isError: true, error: { code: 'WITHDRAWAL_COOLDOWN' },
    });
    setup();
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    // The alert must render the translated coded message, not a raw code dump.
    expect(alert.textContent).not.toContain('WITHDRAWAL_COOLDOWN');
    expect(alert.textContent?.length).toBeGreaterThan(0);
  });

  it('disables submit when the amount exceeds the Funding available balance', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Asset|Activo/i), { target: { value: 'c1' } });
    // BALANCE funding.available is '5'; 6 exceeds it.
    fireEvent.change(screen.getByLabelText(/Amount|Monto/i), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(/address|Dirección/i), { target: { value: 'bc1dest' } });
    expect(screen.getByRole('button', { name: /Withdraw|Retirar/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
