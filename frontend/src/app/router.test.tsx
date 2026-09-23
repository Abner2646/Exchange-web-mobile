import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from './router';
import { AppProviders } from './providers';
import { session } from '../shared/api';

jest.mock('../shared/api', () => ({
  ...jest.requireActual('../shared/api'),
  session: {
    hasToken: jest.fn(),
    getToken: jest.fn(),
    setToken: jest.fn(),
    clearToken: jest.fn(),
  },
}));

describe('App Router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithRouter = (initialEntry: string) => {
    return render(
      <AppProviders>
        <MemoryRouter initialEntries={[initialEntry]}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>
    );
  };

  it('redirects unauthenticated user from authed route to /login', async () => {
    (session.hasToken as jest.Mock).mockReturnValue(false);
    renderWithRouter('/wallet');
    
    await waitFor(() => {
      const passInput = document.querySelector('input[type="password"]');
      expect(passInput).toBeInTheDocument();
    });
  });

  it('renders /wallet for authenticated user', async () => {
    (session.hasToken as jest.Mock).mockReturnValue(true);
    renderWithRouter('/wallet');
    
    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });
  });

  it('renders NotFound for unknown path', () => {
    renderWithRouter('/unknown-route-12345');
    expect(screen.getByText(/404 Not Found/i)).toBeInTheDocument();
  });
});
