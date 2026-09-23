import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { EmailChangeForm } from './EmailChangeForm';
import { profileApi } from '../api';

jest.mock('../api');
jest.mock('../../../shared/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

const mockedProfileApi = profileApi as jest.Mocked<typeof profileApi>;

describe('EmailChangeForm', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    jest.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <EmailChangeForm />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('handles 2-step email change flow', async () => {
    mockedProfileApi.requestEmailChange.mockResolvedValueOnce({ message: 'Code sent' });
    renderComponent();

    fireEvent.change(screen.getByLabelText('New Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Request Email Change' }));

    await waitFor(() => {
      expect(mockedProfileApi.requestEmailChange).toHaveBeenCalledWith({
        nuevoEmail: 'new@example.com',
        passwordActual: 'password123',
      });
      // Advances to step 2 and shows warning
      expect(screen.getByText(/24h withdrawal cooldown/i)).toBeInTheDocument();
    });

    mockedProfileApi.confirmEmailChange.mockResolvedValueOnce({ message: 'Success' });
    fireEvent.change(screen.getByLabelText('Confirmation Code'), { target: { value: '123456' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Code' }));

    await waitFor(() => {
      expect(mockedProfileApi.confirmEmailChange).toHaveBeenCalledWith({ codigo: '123456' });
      expect(screen.getByText('Email changed successfully!')).toBeInTheDocument();
    });
  });

  it('handles invalid code error', async () => {
    mockedProfileApi.requestEmailChange.mockResolvedValueOnce({ message: 'Code sent' });
    renderComponent();

    fireEvent.change(screen.getByLabelText('New Email'), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request Email Change' }));

    await waitFor(() => {
      expect(screen.getByText(/24h withdrawal cooldown/i)).toBeInTheDocument();
    });

    mockedProfileApi.confirmEmailChange.mockRejectedValueOnce({ code: 'INVALID_CODE' });
    fireEvent.change(screen.getByLabelText('Confirmation Code'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Code' }));

    await waitFor(() => {
      expect(screen.getByText('INVALID_CODE')).toBeInTheDocument();
    });
  });
});
