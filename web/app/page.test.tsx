import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';
import { LocaleProvider } from '@/shared/i18n';
import Home, { metadata } from './page';

// The home now embeds the shared <Navbar/> (a client component using the query
// client, i18n and navigation), so provide them. No token → logged-out navbar.
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

function renderHome() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}><LocaleProvider><Home /></LocaleProvider></QueryClientProvider>
  );
}

describe('public home', () => {
  it('renders the marketing headline and the BitFlow brand', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/criptomonedas/i);
    expect(screen.getByText('BitFlow')).toBeInTheDocument();
  });

  it('offers register + sign-in calls to action (locale-agnostic, by href)', () => {
    renderHome();
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/login')).toBe(true);
    expect(links.some((l) => l.getAttribute('href') === '/register')).toBe(true);
  });

  it('declares SEO metadata (title, description, canonical, openGraph)', () => {
    expect(metadata.title).toBeDefined();
    expect(metadata.description).toBeTruthy();
    expect(metadata.alternates?.canonical).toBe('/');
    expect(metadata.openGraph?.title).toBeTruthy();
  });
});
