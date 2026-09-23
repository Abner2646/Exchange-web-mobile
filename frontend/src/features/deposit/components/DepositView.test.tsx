import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { DepositView } from './DepositView';
import * as api from '../api';

jest.mock('../api');
jest.mock('../../../shared/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    locale: 'en'
  })
}));
jest.mock('react-qr-code', () => {
  return function QRCode(props: any) {
    return <svg data-testid="qr-code">{props.value}</svg>;
  };
});

const mockFetchActiveCryptos = api.fetchActiveCryptos as jest.Mock;
const mockFetchDepositAddress = api.fetchDepositAddress as jest.Mock;

const mockCryptos = [
  { id: 'uuid-1', symbol: 'BTC', nombre: 'Bitcoin', network: 'Bitcoin', decimales: 8 },
  { id: 'uuid-2', symbol: 'USDT', nombre: 'Tether', network: 'Ethereum', decimales: 6 },
  { id: 'uuid-3', symbol: 'USDT', nombre: 'Tether', network: 'Tron', decimales: 6 }
];

describe('DepositView', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DepositView />
      </QueryClientProvider>
    );
  };

  it('shows loading state initially', () => {
    mockFetchActiveCryptos.mockImplementation(() => new Promise(() => {}));
    renderComponent();
    expect(screen.getByText('LOADING')).toBeInTheDocument();
  });

  it('renders success state with address, QR code, and copy control', async () => {
    mockFetchActiveCryptos.mockResolvedValue(mockCryptos);
    mockFetchDepositAddress.mockResolvedValue({ address: 'bc1qtest123' });

    renderComponent();

    // Wait for cryptos to load
    await waitFor(() => {
      expect(screen.getByLabelText('SELECT_CRYPTO')).toBeInTheDocument();
    });

    // Check that it auto-selects first crypto (BTC) and loads its address
    await waitFor(() => {
      expect(screen.getAllByText('bc1qtest123')[0]).toBeInTheDocument();
    });

    expect(screen.getAllByTestId('qr-code')[0]).toBeInTheDocument();
    expect(screen.getByText('COPY')).toBeInTheDocument();
    
    // Ensure fetch was called with BTC's id
    expect(mockFetchDepositAddress).toHaveBeenCalledWith('uuid-1');
  });

  it('renders mapped error message on API error', async () => {
    mockFetchActiveCryptos.mockResolvedValue(mockCryptos);
    mockFetchDepositAddress.mockRejectedValue({ code: 'DEPOSIT_ERROR', message: 'raw string' });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('DEPOSIT_ERROR');
    });
    
    // The raw message should not be displayed if it was mapped via i18n
    expect(screen.queryByText('raw string')).not.toBeInTheDocument();
  });

  it('refetches when selecting a different network', async () => {
    mockFetchActiveCryptos.mockResolvedValue(mockCryptos);
    mockFetchDepositAddress.mockResolvedValue({ address: 'bc1qtest123' });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByLabelText('SELECT_CRYPTO')).toBeInTheDocument();
    });

    // Change to USDT
    fireEvent.change(screen.getByLabelText('SELECT_CRYPTO'), { target: { value: 'USDT' } });
    
    await waitFor(() => {
      expect(screen.getByLabelText('SELECT_NETWORK')).toBeInTheDocument();
    });

    // Change to Tron network
    fireEvent.change(screen.getByLabelText('SELECT_NETWORK'), { target: { value: 'Tron' } });

    await waitFor(() => {
      expect(mockFetchDepositAddress).toHaveBeenCalledWith('uuid-3');
    });
  });
});
