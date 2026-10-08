import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import DepositView from './DepositView';

const useMyBalances = vi.fn();
const useDepositAddress = vi.fn();
vi.mock('../queries', () => ({
  useMyBalances: () => useMyBalances(),
  useDepositAddress: (id: string, enabled: boolean) => useDepositAddress(id, enabled),
}));

beforeEach(() => {
  useMyBalances.mockReturnValue({ data: [{ criptomonedaId: 'c1', crypto: { id: 'c1', symbol: 'BTC', network: 'bitcoin' } }] });
  useDepositAddress.mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null });
});

function setup() {
  return render(<LocaleProvider><DepositView /></LocaleProvider>);
}

describe('DepositView', () => {
  it('shows the address once an asset is selected and the query resolves', () => {
    useDepositAddress.mockReturnValue({
      data: { address: 'bc1qexample', qrCode: 'BTC:bc1qexample', metadata: { network: 'bitcoin', confirmationsRequired: 3 }, crypto: {}, mensaje: '' },
      isLoading: false, isError: false, error: null,
    });
    setup();
    fireEvent.change(screen.getByLabelText(/Asset|Activo/i), { target: { value: 'c1' } });
    expect(screen.getByText('bc1qexample')).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });
});
