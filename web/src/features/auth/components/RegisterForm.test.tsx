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

const mutateAsync = vi.fn();
vi.mock('../queries', () => ({
  useRegister: () => ({ mutateAsync, isPending: false }),
}));

import { RegisterForm } from './RegisterForm';

function renderForm() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}><LocaleProvider><RegisterForm /></LocaleProvider></QueryClientProvider>
  );
}

beforeEach(() => { replace.mockReset(); mutateAsync.mockReset(); });

describe('RegisterForm', () => {
  it('submits credentials and routes to /verify-email on success', async () => {
    mutateAsync.mockResolvedValue({ user: {}, token: 'temp', message: 'ok' });
    renderForm();
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Username'), 'neo');
    await userEvent.type(screen.getByLabelText('Password'), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ email: 'a@b.co', username: 'neo', password: 'secret12' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/verify-email'));
  });

  it('shows a coded error message when the API rejects', async () => {
    mutateAsync.mockRejectedValue(new ApiError({ code: 'TOO_MANY_REQUESTS', status: 429 }));
    renderForm();
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Username'), 'neo');
    await userEvent.type(screen.getByLabelText('Password'), 'secret12');
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect(await screen.findByText('Too many attempts. Please wait and try again.')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
