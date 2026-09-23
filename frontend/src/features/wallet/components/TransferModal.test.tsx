import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { TransferModal } from './TransferModal';
import { useBalances, useInternalTransfer } from '../queries';
import { ApiError } from '../../../shared/api';
import { LocaleProvider } from '../../../shared/i18n/LocaleContext';

jest.mock('../queries', () => ({
  useBalances: jest.fn(),
  useInternalTransfer: jest.fn(),
}));

const mockUseBalances = useBalances as jest.Mock;
const mockUseInternalTransfer = useInternalTransfer as jest.Mock;

describe('TransferModal', () => {
  let queryClient: QueryClient;
  let mockMutate: jest.Mock;
  let mockReset: jest.Mock;
  const mockOnClose = jest.fn();

  beforeEach(() => {
    queryClient = new QueryClient();
    mockMutate = jest.fn();
    mockReset = jest.fn();

    mockUseBalances.mockReturnValue({
      data: [
        {
          id: 'asset-btc',
          symbol: 'BTC',
          name: 'Bitcoin',
          funding: { available: '1.50000000', blocked: '0', pending: '0' },
          spot: { available: '0.20000000', blocked: '0' },
        },
        {
          id: 'asset-usdt',
          symbol: 'USDT',
          name: 'Tether',
          funding: { available: '0.00000000', blocked: '0', pending: '0' },
          spot: { available: '100.00000000', blocked: '0' },
        }
      ],
      isLoading: false,
    });

    mockUseInternalTransfer.mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      isSuccess: false,
      error: null,
      reset: mockReset,
    });
  });

  const renderModal = (isOpen = true) => {
    return render(
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <TransferModal isOpen={isOpen} onClose={mockOnClose} />
        </QueryClientProvider>
      </LocaleProvider>
    );
  };

  it('renders modal content correctly', () => {
    renderModal();
    expect(screen.getByTestId('asset-select')).toBeInTheDocument();
    expect(screen.getByTestId('origen-select')).toBeInTheDocument();
    expect(screen.getByTestId('destino-select')).toBeInTheDocument();
    expect(screen.getByTestId('amount-input')).toBeInTheDocument();
  });

  it('rejects invalid amount', async () => {
    renderModal();
    const input = screen.getByTestId('amount-input');
    
    // Type non-numeric
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(screen.getByText('Invalid amount format')).toBeInTheDocument();

    // Type zero
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByText('Amount must be greater than zero')).toBeInTheDocument();

    // Type negative
    fireEvent.change(input, { target: { value: '-1' } });
    expect(screen.getByText('Invalid amount format')).toBeInTheDocument();
    
    // Type > available
    fireEvent.change(input, { target: { value: '2' } }); // 2 > 1.5 BTC available in funding
    expect(screen.getByText('Insufficient available balance')).toBeInTheDocument();

    const submitBtn = screen.getByTestId('submit-transfer-btn');
    expect(submitBtn).toBeDisabled();
  });

  it('Max fills the available balance', () => {
    renderModal();
    
    const maxBtn = screen.getByTestId('max-btn');
    fireEvent.click(maxBtn);

    const input = screen.getByTestId('amount-input') as HTMLInputElement;
    expect(input.value).toBe('1.50000000');
  });

  it('valid submit calls transfer with correct body', () => {
    renderModal();
    
    const input = screen.getByTestId('amount-input');
    fireEvent.change(input, { target: { value: '1.0' } });

    const submitBtn = screen.getByTestId('submit-transfer-btn');
    expect(submitBtn).not.toBeDisabled();
    
    fireEvent.click(submitBtn);

    expect(mockMutate).toHaveBeenCalledWith({
      criptomonedaId: 'asset-btc',
      cantidad: '1',
      origen: 'funding',
      destino: 'spot'
    });
  });

  it('disables submit while pending', () => {
    mockUseInternalTransfer.mockReturnValue({
      mutate: mockMutate,
      isLoading: true,
      isSuccess: false,
      error: null,
      reset: mockReset,
    });
    renderModal();
    
    const submitBtn = screen.getByTestId('submit-transfer-btn');
    expect(submitBtn).toBeDisabled();
  });

  it('shows error on API failure', () => {
    const apiError = new ApiError({ code: 'BALANCE_INSUFFICIENT' });
    mockUseInternalTransfer.mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      isSuccess: false,
      error: apiError,
      reset: mockReset,
    });
    
    renderModal();
    expect(screen.getByTestId('transfer-error')).toBeInTheDocument();
  });

  it('shows success and close button on success', () => {
    mockUseInternalTransfer.mockReturnValue({
      mutate: mockMutate,
      isLoading: false,
      isSuccess: true,
      error: null,
      reset: mockReset,
    });
    
    renderModal();
    expect(screen.getByTestId('transfer-success')).toBeInTheDocument();
    
    fireEvent.click(screen.getByTestId('close-btn'));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('requires origen and destino to differ', () => {
    renderModal();
    
    const destinoSelect = screen.getByTestId('destino-select');
    fireEvent.change(destinoSelect, { target: { value: 'funding' } });
    
    expect(screen.getByTestId('same-compartment-error')).toBeInTheDocument();
    
    const submitBtn = screen.getByTestId('submit-transfer-btn');
    expect(submitBtn).toBeDisabled();
  });
});
