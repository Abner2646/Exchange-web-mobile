import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

let hasToken = false;
vi.mock('@/shared/api', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, session: { hasToken: () => hasToken, getToken: () => (hasToken ? 't' : null), clearToken: vi.fn() } };
});

import AppLayout from './layout';

function renderGuard() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <AppLayout><div>secret</div></AppLayout>
    </QueryClientProvider>
  );
}

beforeEach(() => { replace.mockReset(); });

describe('(app) guard', () => {
  it('redirects to /login when there is no token', () => {
    hasToken = false;
    renderGuard();
    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('renders children when a token exists', () => {
    hasToken = true;
    renderGuard();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});
