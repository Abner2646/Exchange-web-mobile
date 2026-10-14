import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';
import { LocaleProvider } from '@/shared/i18n';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

let hasToken = false;
let unauthorizedCb: (() => void) | null = null;
vi.mock('@/shared/api', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    session: {
      hasToken: () => hasToken,
      getToken: () => (hasToken ? 't' : null),
      clearToken: vi.fn(),
      onUnauthorized: (cb: () => void) => { unauthorizedCb = cb; return () => { unauthorizedCb = null; }; },
    },
  };
});

// Controllable current-user for the emailVerified gate.
let currentUser: { emailVerified: boolean; role?: string } | undefined;
vi.mock('@/features/auth/queries', () => ({ useCurrentUser: () => ({ data: currentUser }) }));

import AppLayout from './layout';

function renderGuard() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <LocaleProvider>
        <AppLayout><div>secret</div></AppLayout>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => { replace.mockReset(); unauthorizedCb = null; currentUser = undefined; });

describe('(app) guard', () => {
  it('redirects to /login when there is no token', async () => {
    hasToken = false;
    renderGuard();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders children when a token exists and the user is verified (or still loading)', () => {
    hasToken = true;
    currentUser = undefined; // query not resolved yet → optimistic render
    renderGuard();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('redirects to /verify-email when the user is not email-verified', async () => {
    hasToken = true;
    currentUser = { emailVerified: false };
    renderGuard();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/verify-email'));
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('does NOT redirect to /verify-email when the user is verified', () => {
    hasToken = true;
    currentUser = { emailVerified: true };
    renderGuard();
    expect(replace).not.toHaveBeenCalledWith('/verify-email');
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('reacts to a 401-driven session clear by redirecting to /login', async () => {
    hasToken = true;
    currentUser = { emailVerified: true };
    renderGuard();
    expect(screen.getByText('secret')).toBeInTheDocument();
    // Simulate the transport clearing the token on a 401 anywhere in the app.
    act(() => { unauthorizedCb?.(); });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });
});
