import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';
import { LocaleProvider } from '@/shared/i18n';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const verifyAsync = vi.fn();
const resendAsync = vi.fn();
vi.mock('../queries', () => ({
  useVerifyEmail: () => ({ mutateAsync: verifyAsync, isPending: false }),
  useResendVerification: () => ({ mutateAsync: resendAsync, isPending: false }),
}));

import { VerifyEmailForm } from './VerifyEmailForm';

function renderForm() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}><LocaleProvider><VerifyEmailForm /></LocaleProvider></QueryClientProvider>
  );
}

beforeEach(() => { replace.mockReset(); verifyAsync.mockReset(); resendAsync.mockReset(); });

describe('VerifyEmailForm', () => {
  it('verifies the code (sent as codigo) and routes to /dashboard', async () => {
    verifyAsync.mockResolvedValue({ user: {}, token: 'jwt', message: 'ok' });
    renderForm();
    await userEvent.type(screen.getByLabelText('Code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    await waitFor(() => expect(verifyAsync).toHaveBeenCalledWith({ codigo: '123456' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });

  it('resends the verification code', async () => {
    resendAsync.mockResolvedValue({ message: 'sent' });
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await waitFor(() => expect(resendAsync).toHaveBeenCalled());
  });
});
