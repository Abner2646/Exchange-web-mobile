import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';
import { LocaleProvider } from '@/shared/i18n';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const googleAsync = vi.fn();
vi.mock('../queries', () => ({ useGoogleLogin: () => ({ mutateAsync: googleAsync, isPending: false }) }));

// Stub the Google widget: a button that fires onSuccess with a credential.
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess }: { onSuccess: (r: { credential: string }) => void }) => (
    <button type="button" onClick={() => onSuccess({ credential: 'gcred' })}>google-widget</button>
  ),
}));

import { GoogleSignInButton } from './GoogleSignInButton';

function renderBtn() {
  const qc = makeQueryClient();
  return render(<QueryClientProvider client={qc}><LocaleProvider><GoogleSignInButton /></LocaleProvider></QueryClientProvider>);
}

beforeEach(() => { replace.mockReset(); googleAsync.mockReset(); });
afterEach(() => { delete (process.env as Record<string, string | undefined>).NEXT_PUBLIC_GOOGLE_CLIENT_ID; });

describe('GoogleSignInButton', () => {
  it('renders nothing when no client id is configured', () => {
    renderBtn();
    expect(screen.queryByText('google-widget')).not.toBeInTheDocument();
  });

  it('logs in with the idToken and routes to /dashboard when configured', async () => {
    (process.env as Record<string, string | undefined>).NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'cid';
    googleAsync.mockResolvedValue({ user: {}, token: 'jwt' });
    renderBtn();
    await userEvent.click(screen.getByText('google-widget'));
    await waitFor(() => expect(googleAsync).toHaveBeenCalledWith({ idToken: 'gcred' }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/dashboard'));
  });
});
