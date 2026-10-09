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
  it('walks request → code → reset and routes to /dashboard', async () => {
    forgotAsync.mockResolvedValue({ message: 'sent' });
    verifyCodeAsync.mockResolvedValue({});
    resetAsync.mockResolvedValue({ user: {}, token: 'jwt' });
    renderForm();

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }));
    await waitFor(() => expect(forgotAsync).toHaveBeenCalledWith({ email: 'a@b.co' }));

    await userEvent.type(await screen.findByLabelText('Code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await waitFor(() => expect(verifyCodeAsync).toHaveBeenCalledWith({ email: 'a@b.co', codigo: '123456' }));

    await userEvent.type(await screen.findByLabelText('New password'), 'newsecret1');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'newsecret1');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => expect(resetAsync).toHaveBeenCalledWith({ email: 'a@b.co', codigo: '123456', newPassword: 'newsecret1', confirmPassword: 'newsecret1' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('blocks the reset step when passwords do not match', async () => {
    forgotAsync.mockResolvedValue({ message: 'sent' });
    verifyCodeAsync.mockResolvedValue({});
    renderForm();
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset code' }));
    await userEvent.type(await screen.findByLabelText('Code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    await userEvent.type(await screen.findByLabelText('New password'), 'aaaa1111');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'bbbb2222');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(resetAsync).not.toHaveBeenCalled();
  });
});
