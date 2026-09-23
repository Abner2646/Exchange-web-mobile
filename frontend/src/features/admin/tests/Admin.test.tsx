import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { MakerCheckerInbox } from '../components/MakerCheckerInbox';
import { BusinessConfigEditor } from '../components/BusinessConfigEditor';
import { LocaleProvider } from '../../../shared/i18n/LocaleContext';
import * as api from '../api';

jest.mock('../api');

const mockedApi = api as jest.Mocked<typeof api>;

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <LocaleProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          {ui}
        </MemoryRouter>
      </QueryClientProvider>
    </LocaleProvider>
  );
};

describe('Admin Feature Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('MakerCheckerInbox', () => {
    it('renders pending actions with formatted amounts', async () => {
      mockedApi.fetchPendingActions.mockResolvedValueOnce({
        pending: [
          {
            id: '1',
            actionType: 'WITHDRAWAL',
            payload: {},
            amountUsd: '1500.50' as any,
            status: 'pending',
            makerUserId: 'user-1',
            created_at: '2026-09-23T10:00:00Z',
            expires_at: '2026-09-24T10:00:00Z',
          }
        ]
      });

      renderWithProviders(<MakerCheckerInbox />);

      expect(await screen.findByText('WITHDRAWAL')).toBeInTheDocument();
    });

    it('Approve opens the 2FA dialog and calls approveAction with the code; disables while pending', async () => {
      mockedApi.fetchPendingActions.mockResolvedValueOnce({
        pending: [
          {
            id: '1',
            actionType: 'WITHDRAWAL',
            payload: {},
            amountUsd: '1500.50' as any,
            status: 'pending',
            makerUserId: 'user-1',
            created_at: '2026-09-23T10:00:00Z',
            expires_at: '2026-09-24T10:00:00Z',
          }
        ]
      });

      let resolveApprove: (val: any) => void = () => {};
      mockedApi.approveAction.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          resolveApprove = resolve;
        });
      });

      renderWithProviders(<MakerCheckerInbox />);

      const approveBtn = await screen.findByRole('button', { name: 'Approve' });
      fireEvent.click(approveBtn);

      expect(await screen.findByText(/Please enter your 2FA code/i)).toBeInTheDocument();

      const input = screen.getByLabelText('2FA Code');
      
      act(() => {
        fireEvent.change(input, { target: { value: '123456' } });
      });

      const confirmBtn = screen.getByRole('button', { name: 'Confirm Approve' });
      
      act(() => {
        fireEvent.click(confirmBtn);
      });

      await waitFor(() => {
        expect(mockedApi.approveAction).toHaveBeenCalledWith({ id: '1', codigo: '123456' });
      });
      
      expect(confirmBtn).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Approving...' })).toBeInTheDocument();

      await act(async () => {
        resolveApprove({} as any);
      });
      
      await waitFor(() => {
        expect(screen.queryByText(/Please enter your 2FA code/i)).not.toBeInTheDocument();
      });
    });

    it('renders a friendly mapped message for MAKER_CHECKER_SAME_USER error', async () => {
      mockedApi.fetchPendingActions.mockResolvedValueOnce({
        pending: [
          {
            id: '1',
            actionType: 'WITHDRAWAL',
            payload: {},
            amountUsd: '1500.50' as any,
            status: 'pending',
            makerUserId: 'user-1',
            created_at: '2026-09-23T10:00:00Z',
            expires_at: '2026-09-24T10:00:00Z',
          }
        ]
      });

      mockedApi.approveAction.mockRejectedValueOnce({
        response: { data: { error: { code: 'MAKER_CHECKER_SAME_USER' } } }
      });

      renderWithProviders(<MakerCheckerInbox />);

      const approveBtn = await screen.findByRole('button', { name: 'Approve' });
      
      act(() => {
        fireEvent.click(approveBtn);
      });

      expect(await screen.findByText(/Please enter your 2FA code/i)).toBeInTheDocument();

      const input = screen.getByLabelText('2FA Code');
      
      act(() => {
        fireEvent.change(input, { target: { value: '123456' } });
      });

      const confirmBtn = screen.getByRole('button', { name: 'Confirm Approve' });
      
      act(() => {
        fireEvent.click(confirmBtn);
      });

      expect(await screen.findByText('You cannot approve your own proposal.')).toBeInTheDocument();
    });
  });

  describe('BusinessConfigEditor', () => {
    it('loads values and submits an update', async () => {
      mockedApi.fetchConfig.mockResolvedValueOnce({
        data: [
          {
            key: 'fees_trading',
            value: '0.01',
            type: 'number',
            description: 'Trading fees',
          }
        ]
      });

      mockedApi.updateConfig.mockResolvedValueOnce({
        message: 'Saved',
        data: {
          key: 'fees_trading',
          value: '0.02',
          type: 'number',
        }
      });

      renderWithProviders(<BusinessConfigEditor />);

      expect(await screen.findByText('fees_trading')).toBeInTheDocument();
      
      const input = await screen.findByTestId('config-input-fees_trading');
      
      act(() => {
        fireEvent.input(input, { target: { value: '0.02' } });
        fireEvent.change(input, { target: { value: '0.02' } });
      });

      expect(input).toHaveValue('0.02');

      const row = await screen.findByTestId('config-row-fees_trading');
      
      act(() => {
        fireEvent.submit(row);
      });

      await waitFor(() => {
        expect(mockedApi.updateConfig).toHaveBeenCalledWith(
          expect.objectContaining({ key: 'fees_trading', value: '0.02' })
        );
      });
    });
  });
});
