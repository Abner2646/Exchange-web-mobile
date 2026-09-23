import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { SwapWidget } from './SwapWidget';
import { calculateSwap } from '../api';
import { useTranslation } from '../../../shared/i18n';

jest.mock('../api');
jest.mock('../../../shared/i18n', () => ({
  useTranslation: jest.fn(),
  locale: 'en-US'
}));

const mockCalculateSwap = calculateSwap as jest.MockedFunction<typeof calculateSwap>;

describe('SwapWidget', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockCalculateSwap.mockReset();
  });

  const renderComponent = (locale = 'en-US') => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key === 'EXCHANGE_ERROR' ? 'Translated Error Message' : key,
      locale,
    });
    
    return render(
      <QueryClientProvider client={queryClient}>
        <SwapWidget />
      </QueryClientProvider>
    );
  };

  test('amount input rejects invalid locale input and shows an error', async () => {
    renderComponent('en-US');
    const input = screen.getByLabelText(/Amount/i);
    fireEvent.change(input, { target: { value: 'abc' } });
    
    expect(await screen.findByText('INVALID_CHARACTERS')).toBeInTheDocument();
  });

  test('accepts valid input according to locale (comma in es-AR) and triggers calculate', async () => {
    mockCalculateSwap.mockResolvedValueOnce({
      rate: '10.50' as any,
      fee: '1.00' as any,
      netAmount: '9.50' as any,
    });

    renderComponent('es-AR');
    
    const input = screen.getByLabelText(/Amount/i);
    // es-AR uses comma for decimals
    fireEvent.change(input, { target: { value: '0,5' } });

    await waitFor(() => {
      expect(mockCalculateSwap).toHaveBeenCalledWith(expect.objectContaining({
        amount: '0.5' // The canonical amount parsed
      }));
    });

    // Verify it renders the formatted result
    // The formatDisplay with es-AR for 9.50 would likely be 9,50
    expect(await screen.findByText(/9,50/)).toBeInTheDocument();
    expect(await screen.findByText(/1,00/)).toBeInTheDocument();
  });

  test('error state renders a mapped message', async () => {
    mockCalculateSwap.mockRejectedValueOnce({
      code: 'EXCHANGE_ERROR',
      message: 'Raw backend error'
    });

    renderComponent('en-US');
    
    const input = screen.getByLabelText(/Amount/i);
    fireEvent.change(input, { target: { value: '1.5' } });

    // Expect the mapped message to be shown, NOT the raw one
    expect(await screen.findByText('Translated Error Message')).toBeInTheDocument();
    expect(screen.queryByText('Raw backend error')).not.toBeInTheDocument();
  });
});

