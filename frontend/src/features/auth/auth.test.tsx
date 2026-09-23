import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RegisterForm } from './components/RegisterForm';
import { LoginForm } from './components/LoginForm';
import { VerifyEmailForm } from './components/VerifyEmailForm';
import { RequireAuth } from './routes';
import { authApi } from './api';
import { session, ApiError } from '../../shared/api';
import { LocaleProvider } from '../../shared/i18n';

jest.mock('./api', () => ({
  authApi: {
    register: jest.fn(),
    login: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerification: jest.fn(),
  }
}));

jest.mock('../../shared/api', () => {
  const original = jest.requireActual('../../shared/api');
  return {
    ...original,
    session: {
      ...original.session,
      setToken: jest.fn(),
      clearToken: jest.fn(),
      hasToken: jest.fn(),
    }
  };
});

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithProviders = (ui: React.ReactElement, queryClient = createTestQueryClient()) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <MemoryRouter>
          {ui}
        </MemoryRouter>
      </LocaleProvider>
    </QueryClientProvider>
  );
};

describe('Auth Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('RegisterForm', () => {
    it('validates required fields and submits, mapping a typed error', async () => {
      renderWithProviders(<RegisterForm />);
      
      const submitBtn = screen.getByRole('button', { name: 'auth.register.submit' });
      fireEvent.click(submitBtn);
      
      // Should show validation errors (we use 'validation.required' in the translation key)
      expect(await screen.findAllByText('validation.required')).toHaveLength(3);
      
      // Fill the form
      fireEvent.change(screen.getByLabelText('auth.register.username'), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByLabelText('auth.register.email'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByLabelText('auth.register.password'), { target: { value: 'password123' } });
      
      // Mock error response
      (authApi.register as jest.Mock).mockRejectedValue(new ApiError({ code: 'USER_EXISTS' }));
      
      fireEvent.click(submitBtn);
      
      await waitFor(() => {
        expect(authApi.register).toHaveBeenCalledWith({
          username: 'testuser',
          email: 'test@test.com',
          password: 'password123',
        });
      });
      
      expect(await screen.findByRole('alert')).toHaveTextContent('USER_EXISTS'); // Fallback handles the code
    });
  });

  describe('LoginForm', () => {
    it('submits, stores the token via session on success, and surfaces a mapped error on 401', async () => {
      renderWithProviders(<LoginForm />);
      
      fireEvent.change(screen.getByLabelText('auth.login.email'), { target: { value: 'test@test.com' } });
      fireEvent.change(screen.getByLabelText('auth.login.password'), { target: { value: 'password123' } });
      
      const submitBtn = screen.getByRole('button', { name: 'auth.login.submit' });
      
      // Mock error first
      (authApi.login as jest.Mock).mockRejectedValue(new ApiError({ code: 'INVALID_CREDENTIALS' }));
      fireEvent.click(submitBtn);
      expect(await screen.findByRole('alert')).toHaveTextContent('INVALID_CREDENTIALS');
      
      // Mock success
      (authApi.login as jest.Mock).mockResolvedValue({
        token: 'fake-jwt',
        user: { id: '1', username: 'testuser' },
      });
      fireEvent.click(submitBtn);
      
      await waitFor(() => {
        expect(session.setToken).toHaveBeenCalledWith('fake-jwt');
      });
      expect(await screen.findByRole('status')).toHaveTextContent('auth.login.success');
    });
  });

  describe('VerifyEmailForm', () => {
    it('submits a code and handles invalid-code error', async () => {
      renderWithProviders(<VerifyEmailForm />);
      
      fireEvent.change(screen.getByLabelText('auth.verifyEmail.code'), { target: { value: '123456' } });
      
      const submitBtn = screen.getByRole('button', { name: 'auth.verifyEmail.submit' });
      
      // Mock error
      (authApi.verifyEmail as jest.Mock).mockRejectedValue(new ApiError({ code: 'INVALID_VERIFICATION_CODE' }));
      fireEvent.click(submitBtn);
      
      await waitFor(() => {
        expect(authApi.verifyEmail).toHaveBeenCalledWith({ code: '123456' });
      });
      expect(await screen.findByRole('alert')).toHaveTextContent('INVALID_VERIFICATION_CODE');
    });
  });

  describe('RequireAuth', () => {
    it('redirects to /login when there is no token', () => {
      (session.hasToken as jest.Mock).mockReturnValue(false);
      
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={['/protected']}>
            <Routes>
              <Route path="/login" element={<div>Login Page</div>} />
              <Route path="/protected" element={<RequireAuth><div>Protected Content</div></RequireAuth>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );
      
      expect(screen.getByText('Login Page')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('renders children when there is a token', () => {
      (session.hasToken as jest.Mock).mockReturnValue(true);
      
      render(
        <QueryClientProvider client={createTestQueryClient()}>
          <MemoryRouter initialEntries={['/protected']}>
            <Routes>
              <Route path="/login" element={<div>Login Page</div>} />
              <Route path="/protected" element={<RequireAuth><div>Protected Content</div></RequireAuth>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      );
      
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
      expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    });
  });
});
