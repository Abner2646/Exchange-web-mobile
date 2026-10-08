import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';
import { LocaleProvider } from '@/shared/i18n';
import { ApiError } from '@/shared/api';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const loginAsync = vi.fn();
const verify2faAsync = vi.fn();
const resend2faAsync = vi.fn();
vi.mock('../queries', () => ({
  useLogin: () => ({ mutateAsync: loginAsync, isPending: false }),
  useVerify2FA: () => ({ mutateAsync: verify2faAsync, isPending: false }),
  useResend2FA: () => ({ mutateAsync: resend2faAsync, isPending: false }),
}));

import { LoginForm } from './LoginForm';

function renderForm() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}><LocaleProvider><LoginForm /></LocaleProvider></QueryClientProvider>
  );
}

async function fillCreds() {
  await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
  await userEvent.type(screen.getByLabelText('Password'), 'secret12');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

beforeEach(() => { replace.mockReset(); loginAsync.mockReset(); verify2faAsync.mockReset(); resend2faAsync.mockReset(); });

describe('LoginForm', () => {
  it('direct login routes to /dashboard', async () => {
    loginAsync.mockResolvedValue({ user: {}, token: 'jwt' });
    renderForm();
    await fillCreds();
    await waitFor(() => expect(loginAsync).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret12' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('TOTP challenge shows the authenticator step WITHOUT a resend button', async () => {
    loginAsync.mockResolvedValue({ requires2FA: true, twoFactorMethod: 'totp', temporalToken: 'tt' });
    renderForm();
    await fillCreds();
    expect(await screen.findByText('Enter your authenticator code')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resend code' })).not.toBeInTheDocument();
  });

  it('email challenge shows a resend button and completes verify-2fa', async () => {
    loginAsync.mockResolvedValue({ requires2FA: true, twoFactorMethod: 'email', temporalToken: 'tt' });
    verify2faAsync.mockResolvedValue({ user: {}, token: 'jwt' });
    renderForm();
    await fillCreds();
    expect(await screen.findByText('Enter the code sent to your email')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await waitFor(() => expect(resend2faAsync).toHaveBeenCalledWith({ temporalToken: 'tt' }));
    await userEvent.type(screen.getByLabelText('Code'), '654321');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(verify2faAsync).toHaveBeenCalledWith({ temporalToken: 'tt', codigo: '654321' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows a coded error on invalid credentials', async () => {
    loginAsync.mockRejectedValue(new ApiError({ code: 'INVALID_CREDENTIALS', status: 401 }));
    renderForm();
    await fillCreds();
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
