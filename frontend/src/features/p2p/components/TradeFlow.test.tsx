import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TradeFlow } from './TradeFlow';
import * as api from '../api';
import * as authQueries from '../../auth/queries';
import { LocaleProvider } from '../../../shared/i18n/LocaleContext';

jest.mock('../api');
jest.mock('../../auth/queries');

const mockGetTransaction = api.getTransaction as jest.MockedFunction<typeof api.getTransaction>;
const mockMarkPaymentSent = api.markPaymentSent as jest.MockedFunction<typeof api.markPaymentSent>;
const mockConfirmReceipt = api.confirmReceipt as jest.MockedFunction<typeof api.confirmReceipt>;
const mockUseUser = authQueries.useUser as jest.MockedFunction<typeof authQueries.useUser>;

describe('TradeFlow', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <MemoryRouter initialEntries={['/p2p/trade/123']}>
            <Routes>
              <Route path="/p2p/trade/:id" element={<TradeFlow />} />
            </Routes>
          </MemoryRouter>
        </LocaleProvider>
      </QueryClientProvider>
    );
  };

  it('renders primary action for buyer in initiated state', async () => {
    mockUseUser.mockReturnValue({ data: { id: 'buyer-id' } } as any);
    mockGetTransaction.mockResolvedValue({
      id: '123', buyerId: 'buyer-id', sellerId: 'seller-id', amount: '100.00', status: 'initiated', cryptoId: 'BTC'
    } as any);

    renderComponent();

    expect(await screen.findByTestId('tx-status')).toHaveTextContent('initiated');
    expect(screen.getByTestId('btn-mark-paid')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-release')).not.toBeInTheDocument();
  });

  it('renders primary action for seller in payment_confirmed state', async () => {
    mockUseUser.mockReturnValue({ data: { id: 'seller-id' } } as any);
    mockGetTransaction.mockResolvedValue({
      id: '123', buyerId: 'buyer-id', sellerId: 'seller-id', amount: '100.00', status: 'payment_confirmed', cryptoId: 'BTC'
    } as any);

    renderComponent();

    expect(await screen.findByTestId('tx-status')).toHaveTextContent('payment_confirmed');
    expect(screen.getByTestId('btn-release')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-mark-paid')).not.toBeInTheDocument();
  });

  it('calls markPaymentSent and disables button while pending', async () => {
    mockUseUser.mockReturnValue({ data: { id: 'buyer-id' } } as any);
    mockGetTransaction.mockResolvedValue({
      id: '123', buyerId: 'buyer-id', sellerId: 'seller-id', amount: '100.00', status: 'initiated', cryptoId: 'BTC'
    } as any);
    
    let resolveMutation: any;
    mockMarkPaymentSent.mockReturnValue(new Promise(resolve => { resolveMutation = resolve; }));

    renderComponent();

    const btn = await screen.findByTestId('btn-mark-paid');
    fireEvent.click(btn);

    await waitFor(() => expect(mockMarkPaymentSent).toHaveBeenCalledWith('123'));
    expect(btn).toBeDisabled();

    resolveMutation({ id: '123', status: 'payment_confirmed' });
    await waitFor(() => expect(mockGetTransaction).toHaveBeenCalledTimes(2)); // refetch
  });

  it('seller release requires double-confirmation', async () => {
    mockUseUser.mockReturnValue({ data: { id: 'seller-id' } } as any);
    mockGetTransaction.mockResolvedValue({
      id: '123', buyerId: 'buyer-id', sellerId: 'seller-id', amount: '100.00', status: 'payment_confirmed', cryptoId: 'BTC'
    } as any);
    mockConfirmReceipt.mockResolvedValue({} as any);

    renderComponent();

    const releaseBtn = await screen.findByTestId('btn-release');
    fireEvent.click(releaseBtn);

    const confirmDialogBtn = await screen.findByTestId('btn-confirm-release');
    fireEvent.click(confirmDialogBtn);

    await waitFor(() => expect(mockConfirmReceipt).toHaveBeenCalledWith('123'));
  });

  it('renders mapped error on 4xx rejection', async () => {
    mockUseUser.mockReturnValue({ data: { id: 'buyer-id' } } as any);
    mockGetTransaction.mockResolvedValue({
      id: '123', buyerId: 'buyer-id', sellerId: 'seller-id', amount: '100.00', status: 'initiated', cryptoId: 'BTC'
    } as any);
    
    mockMarkPaymentSent.mockRejectedValue({
      response: { data: { error: { code: 'P2P_TX_INVALID_STATE' } } }
    });

    renderComponent();

    const btn = await screen.findByTestId('btn-mark-paid');
    fireEvent.click(btn);

    const err = await screen.findByTestId('mutation-error');
    expect(err).toBeInTheDocument();
  });
});
