import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';
import { LocaleProvider } from '@/shared/i18n';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const forgotAsync = vi.fn();
const verifyCodeAsync = vi.fn();
const resetAsync = vi.fn();
vi.mock('../queries', () => ({
  useForgotPassword: () => ({ mutateAsync: forgotAsync, isPending: false }),
  useVerifyResetCode: () => ({ mutateAsync: verifyCodeAsync, isPending: false }),
  useResetPassword: () => ({ mutateAsync: resetAsync, isPending: false }),
}));

import { ForgotPasswordForm } from './ForgotPasswordForm';

function renderForm() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}><LocaleProvider><ForgotPasswordForm /></LocaleProvider></QueryClientProvider>
  );
}

beforeEach(() => { replace.mockReset(); forgotAsync.mockReset(); verifyCodeAsync.mockReset(); resetAsync.mockReset(); });

describe('ForgotPasswordForm', () => {
  it('walks request → code → reset and routes to the home', async () => {
    forgotAsync.mockResolvedValue({ message: 'sent' });
    verifyCodeAsync.mockResolvedValue({});
    resetAsync.mockResolvedValue({ user: {}, token: 'jwt' });
    renderForm();

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.click(screen.getByRole('button', { name: 'Send Recovery Code' }));
    await waitFor(() => expect(forgotAsync).toHaveBeenCalledWith({ email: 'a@b.co' }));

    await userEvent.type(await screen.findByLabelText('Verification code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify Code' }));
    await waitFor(() => expect(verifyCodeAsync).toHaveBeenCalledWith({ email: 'a@b.co', codigo: '123456' }));

    await userEvent.type(await screen.findByLabelText('New Password'), 'newsecret1');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'newsecret1');
    await userEvent.click(screen.getByRole('button', { name: 'Save New Password' }));
    await waitFor(() => expect(resetAsync).toHaveBeenCalledWith({ email: 'a@b.co', codigo: '123456', newPassword: 'newsecret1', confirmPassword: 'newsecret1' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('blocks the reset step when passwords do not match', async () => {
    forgotAsync.mockResolvedValue({ message: 'sent' });
    verifyCodeAsync.mockResolvedValue({});
    renderForm();
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.click(screen.getByRole('button', { name: 'Send Recovery Code' }));
    await userEvent.type(await screen.findByLabelText('Verification code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify Code' }));
    await userEvent.type(await screen.findByLabelText('New Password'), 'aaaa1111');
    await userEvent.type(screen.getByLabelText('Confirm Password'), 'bbbb2222');
    await userEvent.click(screen.getByRole('button', { name: 'Save New Password' }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(resetAsync).not.toHaveBeenCalled();
  });
});
