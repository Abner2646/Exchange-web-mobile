import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { SwapWidget } from './SwapWidget';
import { calculateSwap, executeSwap } from '../api';
import { useTranslation, useErrorTranslation } from '../../../shared/i18n';

jest.mock('../api');
jest.mock('../../../shared/i18n', () => ({
  useTranslation: jest.fn(),
  useErrorTranslation: jest.fn(),
}));

jest.mock('../../../shared/api', () => ({
  isApiError: (e: any) => e && e.code === 'EXECUTE_ERROR',
  apiClient: { post: jest.fn() }
}));

const mockCalculateSwap = calculateSwap as jest.MockedFunction<typeof calculateSwap>;
const mockExecuteSwap = executeSwap as jest.MockedFunction<typeof executeSwap>;

describe('SwapWidget', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    mockCalculateSwap.mockReset();
    mockExecuteSwap.mockReset();
  });

  const renderComponent = (locale = 'en-US') => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key === 'EXCHANGE_ERROR' ? 'Translated Error Message' : key,
      locale,
    });
    (useErrorTranslation as jest.Mock).mockReturnValue({
      tError: (key: string) => key === 'EXECUTE_ERROR' ? 'Translated Execute Error' : key,
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

  test('confirm modal opens only with valid preview, and confirm triggers executeSwap', async () => {
    mockCalculateSwap.mockResolvedValueOnce({
      rate: '10.50' as any,
      fee: '1.00' as any,
      netAmount: '9.50' as any,
    });
    mockExecuteSwap.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({}), 100)));

    renderComponent('en-US');
    
    const input = screen.getByLabelText(/Amount/i);
    fireEvent.change(input, { target: { value: '1.5' } });

    const convertBtn = await screen.findByTestId('convert-btn');
    fireEvent.click(convertBtn);

    expect(screen.getByText('Confirm Swap')).toBeInTheDocument();
    expect(screen.getAllByText(/INDICATIVE PREVIEW/).length).toBeGreaterThan(0);

    const confirmBtn = screen.getByTestId('confirm-swap-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockExecuteSwap).toHaveBeenCalledWith({
        from: 'BTC',
        to: 'USDT',
        amount: '1.5',
        source: 'funding'
      });
    });

    // Check disable while pending
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByText('Processing...')).toBeInTheDocument();
    
    // Wait for success
    await waitFor(() => {
      expect(screen.getByTestId('swap-success')).toBeInTheDocument();
    });
  });

  test('execute error renders a mapped message in modal', async () => {
    mockCalculateSwap.mockResolvedValueOnce({
      rate: '10.50' as any,
      fee: '1.00' as any,
      netAmount: '9.50' as any,
    });
    // Create an object that satisfies the mocked isApiError
    mockExecuteSwap.mockRejectedValueOnce({ code: 'EXECUTE_ERROR' });
    
    renderComponent('en-US');
    
    const input = screen.getByLabelText(/Amount/i);
    fireEvent.change(input, { target: { value: '1.5' } });

    const convertBtn = await screen.findByTestId('convert-btn');
    fireEvent.click(convertBtn);

    const confirmBtn = screen.getByTestId('confirm-swap-btn');
    fireEvent.click(confirmBtn);

    expect(await screen.findByText('Translated Execute Error')).toBeInTheDocument();
  });
});


