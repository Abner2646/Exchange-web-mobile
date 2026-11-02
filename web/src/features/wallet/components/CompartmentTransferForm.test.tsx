// web/src/features/wallet/components/CompartmentTransferForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocaleProvider } from '@/shared/i18n';
import CompartmentTransferForm from './CompartmentTransferForm';

const mutateAsync = vi.fn();
const useCompartmentTransfer = vi.fn();
const useMyBalances = vi.fn();

vi.mock('../queries', () => ({
  useCompartmentTransfer: () => useCompartmentTransfer(),
  useMyBalances: () => useMyBalances(),
}));

const BALANCE = [{
  criptomonedaId: 'c1',
  compartments: { funding: { available: '300', blocked: '0', pending: '0' }, spot: { available: '200', blocked: '0' } },
  crypto: { id: 'c1', symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', decimals: 8 },
}];

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue({ message: 'ok', data: { from: 'funding', to: 'spot' } });
  useCompartmentTransfer.mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null });
  useMyBalances.mockReturnValue({ data: BALANCE });
});

function setup() {
  return render(<LocaleProvider><CompartmentTransferForm /></LocaleProvider>);
}

// The crypto/compartment pickers use the custom Select (button trigger + listbox).
async function pick(triggerName: RegExp, optionName: RegExp) {
  await userEvent.click(screen.getByRole('button', { name: triggerName }));
  await userEvent.click(screen.getByRole('option', { name: optionName }));
}

describe('CompartmentTransferForm', () => {
  it('submits {cryptoId,amount,from,to} with distinct compartments', async () => {
    setup();
    await pick(/Asset|Activo/i, /BTC/);
    // Defaults are funding -> spot.
    await userEvent.type(screen.getByLabelText(/Amount|Monto/i), '100');
    await userEvent.click(screen.getByRole('button', { name: /Transfer|Transferir/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ cryptoId: 'c1', amount: '100', from: 'funding', to: 'spot' }));
  });

  it('clears the amount after a successful transfer', async () => {
    setup();
    await pick(/Asset|Activo/i, /BTC/);
    const amount = screen.getByLabelText(/Amount|Monto/i);
    await userEvent.type(amount, '100');
    await userEvent.click(screen.getByRole('button', { name: /Transfer|Transferir/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    await waitFor(() => expect(amount).toHaveValue(''));
  });

  it('blocks submit when amount exceeds source available', async () => {
    setup();
    await pick(/Asset|Activo/i, /BTC/);
    await userEvent.type(screen.getByLabelText(/Amount|Monto/i), '9999');
    expect(screen.getByText(/Insufficient|insuficiente/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transfer|Transferir/i })).toBeDisabled();
  });

  it('does not submit twice while pending', () => {
    useCompartmentTransfer.mockReturnValue({ mutateAsync, isPending: true, isError: false, error: null });
    setup();
    expect(screen.getByRole('button', { name: /Transfer|Transferir/i })).toBeDisabled();
  });

  it('blocks submit and warns when from and to are the same compartment', async () => {
    setup();
    // Default is funding -> spot; force to=funding so from === to.
    await pick(/^To$|^Hacia$/i, /Funding/);
    expect(screen.getByText(/different compartments|compartimentos distintos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transfer|Transferir/i })).toBeDisabled();
  });
});
