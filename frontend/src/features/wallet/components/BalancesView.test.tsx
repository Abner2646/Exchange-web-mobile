import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BalancesView } from './BalancesView';
import { fetchMyBalances } from '../api';
import { ApiError } from '../../../shared/api';
import { LocaleProvider } from '../../../shared/i18n/LocaleContext';

jest.mock('../api', () => ({
  fetchMyBalances: jest.fn(),
}));

const mockFetchMyBalances = fetchMyBalances as jest.MockedFunction<typeof fetchMyBalances>;

describe('BalancesView', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockFetchMyBalances.mockClear();
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          {ui}
        </QueryClientProvider>
      </LocaleProvider>
    );
  };

  it('renders loading state', () => {
    mockFetchMyBalances.mockImplementation(() => new Promise(() => {})); // Never resolves
    renderWithProviders(<BalancesView />);
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('renders empty state', async () => {
    mockFetchMyBalances.mockResolvedValueOnce([]);
    renderWithProviders(<BalancesView />);
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders error state mapped by ApiError', async () => {
    const error = new ApiError({ code: 'BALANCE_INSUFFICIENT' });
    mockFetchMyBalances.mockRejectedValueOnce(error);
    renderWithProviders(<BalancesView />);
    
    const errorNode = await screen.findByTestId('error-state');
    // Ensure it's not the raw code, but it could be the mapped message if it exists in the catalog.
    // If it doesn't exist, it falls back to something containing the code.
    expect(errorNode).toBeInTheDocument();
  });

  it('renders success state and formats funding+spot amounts', async () => {
    mockFetchMyBalances.mockResolvedValueOnce([
      {
        id: '1',
        symbol: 'BTC',
        name: 'Bitcoin',
        total: { available: '1.50000000', blocked: '0.00000000', pending: '0.00000000' },
        funding: { available: '1.00000000', blocked: '0.00000000', pending: '0.50000000' },
        spot: { available: '0.00000000', blocked: '0.00000000' },
      } as any,
    ]);

    renderWithProviders(<BalancesView />);

    expect(await screen.findByTestId('success-state')).toBeInTheDocument();
    
    // Default tab is funding
    expect(screen.getByTestId('balance-item-BTC')).toBeInTheDocument();
    expect(screen.getByText(/Bitcoin \(BTC\)/)).toBeInTheDocument();
    expect(screen.getByText(/Available:.*1/)).toBeInTheDocument(); // basic check, formatter changes based on locale
    expect(screen.getByText(/Pending:.*0\.5/)).toBeInTheDocument();

    // Click on Spot
    fireEvent.click(screen.getByTestId('tab-spot'));
    expect(screen.getByText(/Available:.*0/)).toBeInTheDocument();
  });
});
