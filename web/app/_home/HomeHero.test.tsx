import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ── Mocks (hoisted) ───────────────────────────────────────────────────────────
const hasToken = vi.fn();
vi.mock('@/shared/api', () => ({
  session: { hasToken: () => hasToken(), onUnauthorized: () => () => {} },
}));

const useCurrentUserMock = vi.fn();
vi.mock('@/features/auth/queries', () => ({ useCurrentUser: () => useCurrentUserMock() }));

const useMyBalancesMock = vi.fn();
vi.mock('@/features/wallet/queries', () => ({ useMyBalances: () => useMyBalancesMock() }));

const useMarketsMock = vi.fn();
vi.mock('./coingecko', () => ({ useMarkets: () => useMarketsMock() }));

// The hero renders <TopGainers/> (also a coingecko consumer) — stub it out.
vi.mock('./TopGainers', () => ({ TopGainers: () => <div>stub-TopGainers</div> }));

import { HomeHero } from './HomeHero';

const BTC_BAL = { criptomonedaId: 'c-btc', availableBalance: '0.5', crypto: { symbol: 'BTC', name: 'Bitcoin' } } as any;
const MARKETS = [{ symbol: 'btc', current_price: 60000 }] as any;

beforeEach(() => {
  vi.clearAllMocks();
  useCurrentUserMock.mockReturnValue({ data: { username: 'neo' } });
  useMyBalancesMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
  useMarketsMock.mockReturnValue({ data: MARKETS, isError: false });
});

describe('HomeHero — signed out', () => {
  it('renders the marketing hero (not the dashboard)', () => {
    hasToken.mockReturnValue(false);
    render(<HomeHero />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/criptomonedas/i);
    expect(screen.queryByText(/Hola de nuevo/i)).not.toBeInTheDocument();
  });
});

describe('HomeHero — signed in dashboard', () => {
  beforeEach(() => hasToken.mockReturnValue(true));

  it('greets the user and shows the portfolio total + holding USD value', () => {
    useMyBalancesMock.mockReturnValue({ data: [BTC_BAL], isLoading: false, isError: false, refetch: vi.fn() });
    render(<HomeHero />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Hola de nuevo/i);
    // 0.5 BTC * $60,000 = $30,000.00 (appears as both the total and the holding value)
    expect(screen.getAllByText('$30,000.00').length).toBeGreaterThanOrEqual(1);
  });

  it('shows the empty state when there are no funds', () => {
    useMyBalancesMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    render(<HomeHero />);
    expect(screen.getByText(/Todavía no tenés fondos/i)).toBeInTheDocument();
  });

  it('does NOT show a misleading $0.00 total when live prices are unavailable', () => {
    useMyBalancesMock.mockReturnValue({ data: [BTC_BAL], isLoading: false, isError: false, refetch: vi.fn() });
    useMarketsMock.mockReturnValue({ data: undefined, isError: true });
    render(<HomeHero />);
    // No USD total (shown as a dash) + an honest note; never "$0.00".
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    expect(screen.getByText(/No pudimos cargar los precios/i)).toBeInTheDocument();
  });

  it('surfaces a balance load error with a retry affordance', () => {
    useMyBalancesMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    render(<HomeHero />);
    expect(screen.getByRole('alert')).toHaveTextContent(/No pudimos cargar tus balances/i);
    expect(screen.getByRole('button', { name: /Reintentar/i })).toBeInTheDocument();
  });
});
