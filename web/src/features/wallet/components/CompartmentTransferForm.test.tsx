// web/src/features/wallet/components/CompartmentTransferForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

describe('CompartmentTransferForm', () => {
  it('submits {cryptoId,amount,from,to} with distinct compartments', async () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Asset|Activo/i), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText(/^From$|^Desde$/i), { target: { value: 'funding' } });
    fireEvent.change(screen.getByLabelText(/^To$|^Hacia$/i), { target: { value: 'spot' } });
    fireEvent.change(screen.getByLabelText(/Amount|Monto/i), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /Transfer|Transferir/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ cryptoId: 'c1', amount: '100', from: 'funding', to: 'spot' }));
  });

  it('blocks submit when amount exceeds source available', () => {
    setup();
    fireEvent.change(screen.getByLabelText(/Asset|Activo/i), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText(/^From$|^Desde$/i), { target: { value: 'funding' } });
    fireEvent.change(screen.getByLabelText(/^To$|^Hacia$/i), { target: { value: 'spot' } });
    fireEvent.change(screen.getByLabelText(/Amount|Monto/i), { target: { value: '9999' } });
    expect(screen.getByText(/Insufficient|insuficiente/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transfer|Transferir/i })).toBeDisabled();
  });

  it('does not submit twice while pending', () => {
    useCompartmentTransfer.mockReturnValue({ mutateAsync, isPending: true, isError: false, error: null });
    setup();
    expect(screen.getByRole('button', { name: /Transfer|Transferir/i })).toBeDisabled();
  });

  it('blocks submit and warns when from and to are the same compartment', () => {
    setup();
    // Default is funding -> spot; force to=funding so from === to.
    fireEvent.change(screen.getByLabelText(/^To$|^Hacia$/i), { target: { value: 'funding' } });
    expect(screen.getByText(/different compartments|compartimentos distintos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transfer|Transferir/i })).toBeDisabled();
  });

  it('shows a success message after a completed transfer', () => {
    useCompartmentTransfer.mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null, isSuccess: true });
    setup();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
