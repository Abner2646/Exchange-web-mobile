import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';
import { LocaleProvider } from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme';

// Tests run under the default (en) locale.
const replace = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: () => '/swap', useRouter: () => ({ replace, push: vi.fn() }) }));

let hasToken = false;
vi.mock('@/shared/api', async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    session: {
      hasToken: () => hasToken,
      getToken: () => (hasToken ? 't' : null),
      clearToken: vi.fn(),
      onUnauthorized: () => () => {},
    },
  };
});

const logout = vi.fn();
let currentUser: { username?: string; role?: string; emailVerified?: boolean } | undefined;
vi.mock('@/features/auth/queries', () => ({
  useCurrentUser: () => ({ data: currentUser }),
  useLogout: () => logout,
}));

import { Navbar } from './Navbar';

function renderNav() {
  const qc = makeQueryClient();
  return render(<QueryClientProvider client={qc}><ThemeProvider><LocaleProvider><Navbar /></LocaleProvider></ThemeProvider></QueryClientProvider>);
}

beforeEach(() => { replace.mockReset(); logout.mockReset(); hasToken = false; currentUser = undefined; });

describe('Navbar', () => {
  it('logged out: shows sign-in and sign-up, hides auth-only links and the user menu', async () => {
    hasToken = false;
    renderNav();
    expect(await screen.findByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Sign Up' })).toHaveAttribute('href', '/register');
    // Public links present…
    expect(screen.getByRole('link', { name: /Swap/ })).toHaveAttribute('href', '/swap');
    // …auth-only links absent, no greeting.
    expect(screen.queryByRole('link', { name: /Wallet/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Deposit' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Hi,/)).not.toBeInTheDocument();
  });

  it('logged in: greets the user, shows auth-only links, and the menu logs out', async () => {
    hasToken = true;
    currentUser = { username: 'neo', role: 'user', emailVerified: true };
    renderNav();
    expect(await screen.findByText('Hi, Neo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Wallet/ })).toHaveAttribute('href', '/wallet');
    // The prominent Deposit CTA deep-links to the wallet deposit tab.
    expect(screen.getByRole('link', { name: 'Deposit' })).toHaveAttribute('href', '/wallet?tab=deposit');
    expect(screen.queryByRole('link', { name: 'Sign In' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Hi, Neo/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Log Out' }));
    expect(logout).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('logged in as admin: the user menu includes an Admin link', async () => {
    hasToken = true;
    currentUser = { username: 'root', role: 'super_admin', emailVerified: true };
    renderNav();
    await userEvent.click(await screen.findByRole('button', { name: /Hi, Root/ }));
    expect(screen.getByRole('menuitem', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });
});
