import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { ProfileView } from './ProfileView';
import { profileApi } from '../api';

jest.mock('../api');
jest.mock('../../../shared/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

const mockedProfileApi = profileApi as jest.Mocked<typeof profileApi>;

describe('ProfileView', () => {
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
          <ProfileView />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('renders profile data and handles update', async () => {
    mockedProfileApi.fetchProfile.mockResolvedValue({
      id: '1',
      username: 'johndoe',
      email: 'john@example.com',
      displayName: 'John Doe',
      pais: 'AR',
      estado: 'B',
      locale: 'es',
    });

    renderComponent();

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('johndoe')).toBeInTheDocument();
    });

    // Check that we don't have an input for username
    const usernameP = screen.getByText('johndoe');
    expect(usernameP.tagName).toBe('P');

    const displayNameInput = screen.getByLabelText('Display Name');
    await waitFor(() => {
      expect(displayNameInput).toHaveValue('John Doe');
    });

    // Update form
    mockedProfileApi.updateProfile.mockResolvedValueOnce({
      id: '1',
      username: 'johndoe',
      email: 'john@example.com',
      displayName: 'Johnny',
      pais: 'AR',
      estado: 'B',
      locale: 'es',
    });

    fireEvent.change(displayNameInput, { target: { value: 'Johnny' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockedProfileApi.updateProfile).toHaveBeenCalledWith({
        displayName: 'Johnny',
        pais: 'AR',
        estado: 'B',
        locale: 'es',
      });
      expect(screen.getByText('Profile updated successfully')).toBeInTheDocument();
    });
  });

  it('displays mapped error on update failure', async () => {
    mockedProfileApi.fetchProfile.mockResolvedValueOnce({
      id: '1',
      username: 'johndoe',
      email: 'john@example.com',
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('johndoe')).toBeInTheDocument();
    });

    mockedProfileApi.updateProfile.mockRejectedValueOnce({
      code: 'UPDATE_FAILED',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('UPDATE_FAILED')).toBeInTheDocument();
    });
  });
});
