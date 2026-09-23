import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { TradingTerminal } from './TradingTerminal';
import * as api from '../api';
import { ApiError } from '../../../shared/api/errors';
import { LocaleProvider } from '../../../shared/i18n/LocaleContext';

// Mock lightweight-charts
jest.mock('lightweight-charts', () => ({
  createChart: () => ({
    addCandlestickSeries: () => ({
      setData: () => {},
    }),
    applyOptions: () => {},
    timeScale: () => ({
      fitContent: () => {},
    }),
    remove: () => {},
  }),
}));

// Mock the API module
jest.mock('../api');

const mockFetchPairs = api.fetchPairs as jest.Mock;
const mockFetchOrderBook = api.fetchOrderBook as jest.Mock;
const mockFetchChartData = api.fetchChartData as jest.Mock;

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

describe('TradingTerminal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
    
    // Default mock responses
    mockFetchPairs.mockResolvedValue([
      {
        tradingPairId: 'pair-1',
        symbol: 'BTC/USDT',
        baseAsset: { symbol: 'BTC' },
        quoteAsset: { symbol: 'USDT' },
        lastPrice: '50000.00',
        priceChange24h: 5.2,
        high24h: '51000.00',
        low24h: '49000.00',
        volume24h: '100.5',
        trades24h: 1000
      },
      {
        tradingPairId: 'pair-2',
        symbol: 'ETH/USDT',
        baseAsset: { symbol: 'ETH' },
        quoteAsset: { symbol: 'USDT' },
        lastPrice: '3000.00',
        priceChange24h: -1.5,
        high24h: '3100.00',
        low24h: '2900.00',
        volume24h: '500.5',
        trades24h: 5000
      }
    ]);

    mockFetchOrderBook.mockResolvedValue({
      bids: [{ price: '49999.00', quantity: '0.5' }],
      asks: [{ price: '50001.00', quantity: '1.2' }]
    });

    mockFetchChartData.mockResolvedValue([
      { time: 1620000000, open: 49000, high: 51000, low: 48000, close: 50000 }
    ]);
  });

  it('pair list loads and is searchable/selectable', async () => {
    renderWithProviders(<TradingTerminal />);
    
    // Check loading state
    expect(screen.getAllByText(/Loading/i).length).toBeGreaterThan(0);
    
    // Wait for pairs to load
    await waitFor(() => {
      expect(screen.getByText('BTC/USDT')).toBeInTheDocument();
    });
    expect(screen.getByText('ETH/USDT')).toBeInTheDocument();

    // Searchable
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'eth' } });
    
    expect(screen.queryByText('BTC/USDT')).not.toBeInTheDocument();
    expect(screen.getByText('ETH/USDT')).toBeInTheDocument();
  });

  it('order book success renders bids/asks with formatted prices', async () => {
    renderWithProviders(<TradingTerminal />);
    
    // Wait for order book to load
    await waitFor(() => {
      // 49,999.00 formatting (locale en-US will have comma)
      expect(screen.getByText('49,999.00')).toBeInTheDocument();
      expect(screen.getByText('50,001.00')).toBeInTheDocument();
    });
  });

  it('error state renders a mapped message', async () => {
    // Instead of raw string, mock an ApiError
    mockFetchPairs.mockRejectedValue(new ApiError({ message: 'Error fetching pairs', status: 500, code: 'NETWORK_ERROR' }));
    
    renderWithProviders(<TradingTerminal />);
    
    await waitFor(() => {
      // Assuming error catalog translates NETWORK_ERROR or falls back to showing the code
      expect(screen.getByText(/Code: NETWORK_ERROR/i)).toBeInTheDocument();
    });
  });

  it('selecting a different pair refetches the order book', async () => {
    renderWithProviders(<TradingTerminal />);
    
    await waitFor(() => {
      expect(screen.getByText('ETH/USDT')).toBeInTheDocument();
    });
    
    // Initial fetch for pair-1 (default selected)
    await waitFor(() => {
      expect(mockFetchOrderBook).toHaveBeenCalledWith('pair-1');
    });

    // Click on pair-2
    fireEvent.click(screen.getByText('ETH/USDT'));
    
    await waitFor(() => {
      expect(mockFetchOrderBook).toHaveBeenCalledWith('pair-2');
    });
  });
});
