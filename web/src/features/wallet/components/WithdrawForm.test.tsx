// web/src/features/wallet/components/WithdrawForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  crypto: { id: 'c1', symbol: 'BTC', network: 'bitcoin', decimals: 8 },
}];

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue({ id: 't1', status: 'pending', type: 'withdrawal' });
  useWithdraw.mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null, isSuccess: false });
  useMyBalances.mockReturnValue({ data: BALANCE });
});

function setup() {
  return render(<LocaleProvider><WithdrawForm /></LocaleProvider>);
}

// The asset picker uses the custom Select (button trigger + listbox).
async function pickAsset(optionName: RegExp) {
  await userEvent.click(screen.getByRole('button', { name: /Asset|Activo/i }));
  await userEvent.click(screen.getByRole('option', { name: optionName }));
}

describe('WithdrawForm', () => {
  it('submits {cryptoId,amount,destinationAddress}', async () => {
    setup();
    await pickAsset(/BTC/);
    await userEvent.type(screen.getByLabelText(/Amount|Monto/i), '1');
    await userEvent.type(screen.getByLabelText(/address|Dirección/i), 'bc1dest');
    await userEvent.click(screen.getByRole('button', { name: /Withdraw|Retirar/i }));
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

  it('disables submit when the amount exceeds the Funding available balance', async () => {
    setup();
    await pickAsset(/BTC/);
    // BALANCE funding.available is '5'; 6 exceeds it.
    await userEvent.type(screen.getByLabelText(/Amount|Monto/i), '6');
    await userEvent.type(screen.getByLabelText(/address|Dirección/i), 'bc1dest');
    expect(screen.getByRole('button', { name: /Withdraw|Retirar/i })).toBeDisabled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
