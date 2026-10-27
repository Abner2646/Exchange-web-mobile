import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/app/providers';
import Home, { metadata } from './page';

// The home embeds client market widgets (react-query → CoinGecko). Provide a
// query client and stub fetch so no real network call happens; the widgets sit
// in their loading state, which doesn't affect the hero/SEO assertions below.
beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) })) as unknown as typeof fetch;
});

function renderHome() {
  const qc = makeQueryClient();
  return render(<QueryClientProvider client={qc}><Home /></QueryClientProvider>);
}

describe('public home', () => {
  it('renders the marketing headline', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/criptomonedas/i);
  });

  it('offers a register call to action (hero)', () => {
    renderHome();
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/register')).toBe(true);
  });

  it('declares SEO metadata (title, description, canonical, openGraph)', () => {
    expect(metadata.title).toBeDefined();
    expect(metadata.description).toBeTruthy();
    expect(metadata.alternates?.canonical).toBe('/');
    expect(metadata.openGraph?.title).toBeTruthy();
  });
});
