import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MarketplaceView } from './MarketplaceView';
import * as api from '../api';
import { LocaleProvider } from '../../../shared/i18n/LocaleContext';
import { ApiError } from '../../../shared/api';

jest.mock('../api');

const mockFetchOffers = api.fetchOffers as jest.MockedFunction<typeof api.fetchOffers>;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        {ui}
      </LocaleProvider>
    </QueryClientProvider>
  );
};

describe('MarketplaceView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('renders loading state initially', () => {
    mockFetchOffers.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<MarketplaceView />);
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('renders empty state when no offers returned', async () => {
    mockFetchOffers.mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 }
    });
    
    renderWithProviders(<MarketplaceView />);
    
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders success state with formatted prices', async () => {
    mockFetchOffers.mockResolvedValue({
      data: [
        {
          id: 'offer-1',
          userId: 'user-1',
          type: 'buy',
          cryptoId: 'crypto-1',
          minAmount: '10.00000000' as import('../../../shared/money').CanonicalAmount,
          maxAmount: '100.00000000' as import('../../../shared/money').CanonicalAmount,
          unitPrice: '50000.5000' as import('../../../shared/money').CanonicalAmount,
          fiatCurrency: 'USD',
          active: true,
          paymentMethods: [{ id: 'pm-1', name: 'Bank Transfer', active: true }],
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ],
      pagination: { total: 1, page: 1, limit: 20, totalPages: 1 }
    });

    renderWithProviders(<MarketplaceView />);

    const successState = await screen.findByTestId('success-state');
    expect(successState).toBeInTheDocument();
    expect(screen.getByTestId('offer-card-offer-1')).toBeInTheDocument();
    
    const priceEl = screen.getByTestId('offer-price');
    expect(priceEl).toHaveTextContent('50,000.50'); 
  });

  it('renders mapped error message on API failure', async () => {
    mockFetchOffers.mockRejectedValue(new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Raw backend message'
    }));

    renderWithProviders(<MarketplaceView />);

    const errorEl = await screen.findByTestId('error-state');
    expect(errorEl).toBeInTheDocument();
    // Assuming 'UNAUTHORIZED' maps to something like "Please log in" in the english catalog, 
    // but we can just check it doesn't render 'Raw backend message' if there's a mapped one.
    // In our test, if it maps to fallback it will be "An unknown error occurred (Code: UNAUTHORIZED)."
    expect(errorEl.textContent).not.toContain('Raw backend message');
  });

  it('refetches when filters change', async () => {
    mockFetchOffers.mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 0 }
    });

    renderWithProviders(<MarketplaceView />);

    await screen.findByTestId('empty-state');
    expect(mockFetchOffers).toHaveBeenCalledTimes(1);
    expect(mockFetchOffers).toHaveBeenCalledWith({ type: 'buy' });

    const cryptoInput = screen.getByTestId('filter-crypto');
    fireEvent.change(cryptoInput, { target: { value: 'crypto-2' } });

    await waitFor(() => {
      expect(mockFetchOffers).toHaveBeenCalledTimes(2);
      expect(mockFetchOffers).toHaveBeenCalledWith({ type: 'buy', cryptoId: 'crypto-2' });
    });
  });
});
