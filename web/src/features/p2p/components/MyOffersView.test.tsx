// web/src/features/p2p/components/MyOffersView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mocks (hoisted before component import) ──────────────────────────────────

const mutateToggle = vi.fn();
const mutateDelete = vi.fn();

vi.mock('../queries', () => ({
  useMyOffers: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
  })),
  useToggleOffer: vi.fn(() => ({
    mutate: mutateToggle,
    isPending: false,
    isError: false,
    error: null,
  })),
  useDeleteOffer: vi.fn(() => ({
    mutate: mutateDelete,
    isPending: false,
    isError: false,
    error: null,
  })),
  useCryptoCatalog: vi.fn(() => ({
    data: [
      { id: 'c-btc', symbol: 'BTC', name: 'Bitcoin' },
      { id: 'c-eth', symbol: 'ETH', name: 'Ethereum' },
    ],
  })),
}));

const enCatalog: Record<string, string> = {
  'common.loading': 'Loading...',
  'common.submit': 'Confirm',
  'common.cancel': 'Cancel',
  'p2p.myOffers.title': 'My Offers',
  'p2p.myOffers.empty': 'You have no offers yet.',
  'p2p.myOffers.error': 'Could not load your offers. Please try again.',
  'p2p.myOffers.toggleActive': 'Active',
  'p2p.myOffers.toggleInactive': 'Inactive',
  'p2p.myOffers.deactivate': 'Deactivate',
  'p2p.myOffers.deactivateTitle': 'Deactivate offer',
  'p2p.myOffers.deactivateConfirm': 'Deactivate this offer? It will no longer be visible to other users.',
  'p2p.offers.typeBuy': 'Buy',
  'p2p.offers.typeSell': 'Sell',
  'p2p.offers.price': 'Price',
  'p2p.offers.range': 'Range',
};

vi.mock('@/shared/i18n', () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, string | number>) => {
      const template = enCatalog[k] ?? k;
      if (!p) return template;
      return Object.entries(p).reduce(
        (s, [key, val]) => s.replace(new RegExp(`{{${key}}}`, 'g'), String(val)),
        template,
      );
    },
    locale: 'en',
  }),
}));

vi.mock('@/shared/i18n/errorCatalog', () => ({
  useErrorTranslation: () => ({
    tError: (code: string) => `error:${code}`,
  }),
}));

// Keep real shared/ui (Button + Dialog) so rendering is real.

import {
  useMyOffers,
  useToggleOffer,
  useDeleteOffer,
  useCryptoCatalog,
} from '../queries';
import { MyOffersView } from './MyOffersView';
import type { Offer } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOffer(overrides: Partial<Offer> = {}): Offer {
  return {
    id: 'offer-1',
    userId: 'user-1',
    type: 'sell',
    cryptoId: 'c-btc',
    minAmount: '10',
    maxAmount: '500',
    unitPrice: '60000',
    fiatCurrency: 'USD',
    additionalTerms: null,
    active: true,
    direccionFiat: null,
    paymentMethods: [{ id: 'pm-1', name: 'Bank Transfer', description: null, active: true }],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const ACTIVE_OFFER = makeOffer({ id: 'offer-active', active: true });
const INACTIVE_OFFER = makeOffer({ id: 'offer-inactive', active: false, type: 'buy', cryptoId: 'c-eth' });

beforeEach(() => {
  vi.clearAllMocks();
  (useMyOffers as any).mockReturnValue({
    data: [ACTIVE_OFFER, INACTIVE_OFFER],
    isLoading: false,
    isError: false,
  });
  (useToggleOffer as any).mockReturnValue({
    mutate: mutateToggle,
    isPending: false,
    isError: false,
    error: null,
  });
  (useDeleteOffer as any).mockReturnValue({
    mutate: mutateDelete,
    isPending: false,
    isError: false,
    error: null,
  });
  (useCryptoCatalog as any).mockReturnValue({
    data: [
      { id: 'c-btc', symbol: 'BTC', name: 'Bitcoin' },
      { id: 'c-eth', symbol: 'ETH', name: 'Ethereum' },
    ],
  });
});

// ─── Render states ─────────────────────────────────────────────────────────────

describe('MyOffersView — render states', () => {
  it('shows loading state', () => {
    (useMyOffers as any).mockReturnValue({ data: undefined, isLoading: true, isError: false });
    render(<MyOffersView />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error state with role="alert"', () => {
    (useMyOffers as any).mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<MyOffersView />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toContain('Could not load your offers');
  });

  it('shows empty state when offers list is empty', () => {
    (useMyOffers as any).mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<MyOffersView />);
    expect(screen.getByText('You have no offers yet.')).toBeInTheDocument();
  });

  it('renders both active and inactive offers', () => {
    render(<MyOffersView />);
    // Active offer: BTC (resolved symbol), type=sell, active indicator
    expect(screen.getByText('BTC')).toBeInTheDocument();
    // Inactive offer: ETH (resolved symbol), type=buy
    expect(screen.getByText('ETH')).toBeInTheDocument();
  });

  it('shows active status indicator for active offer', () => {
    render(<MyOffersView />);
    // The active offer should show "Active" label
    const activeLabels = screen.getAllByText('Active');
    expect(activeLabels.length).toBeGreaterThan(0);
  });

  it('shows inactive status indicator for inactive offer', () => {
    render(<MyOffersView />);
    const inactiveLabels = screen.getAllByText('Inactive');
    expect(inactiveLabels.length).toBeGreaterThan(0);
  });

  it('falls back to cryptoId.slice(0,8) when catalog has no match', () => {
    (useCryptoCatalog as any).mockReturnValue({ data: [] });
    const offerWithUnknownCrypto = makeOffer({ cryptoId: 'unknown-crypto-id-xyz' });
    (useMyOffers as any).mockReturnValue({
      data: [offerWithUnknownCrypto],
      isLoading: false,
      isError: false,
    });
    render(<MyOffersView />);
    expect(screen.getByText('unknown-')).toBeInTheDocument();
  });
});

// ─── Toggle action ─────────────────────────────────────────────────────────────

describe('MyOffersView — toggle action', () => {
  it('toggling an active offer calls useToggleOffer().mutate({ id, active: false })', () => {
    render(<MyOffersView />);
    // Find the toggle button for the active offer
    // The active offer row should have a toggle button showing "Active" state
    // Click the toggle for the active offer
    const toggleButtons = screen.getAllByRole('button', { name: /active|inactive/i });
    // First toggle belongs to active offer (offer-active)
    const activeOfferToggle = toggleButtons.find((btn) =>
      btn.closest('[data-offer-id="offer-active"]') !== null,
    );
    expect(activeOfferToggle).toBeDefined();
    fireEvent.click(activeOfferToggle!);
    expect(mutateToggle).toHaveBeenCalledWith({ id: 'offer-active', active: false });
  });

  it('toggling an inactive offer calls useToggleOffer().mutate({ id, active: true })', () => {
    render(<MyOffersView />);
    const toggleButtons = screen.getAllByRole('button', { name: /active|inactive/i });
    const inactiveOfferToggle = toggleButtons.find((btn) =>
      btn.closest('[data-offer-id="offer-inactive"]') !== null,
    );
    expect(inactiveOfferToggle).toBeDefined();
    fireEvent.click(inactiveOfferToggle!);
    expect(mutateToggle).toHaveBeenCalledWith({ id: 'offer-inactive', active: true });
  });
});

// ─── Deactivate (delete) Dialog flow ──────────────────────────────────────────

describe('MyOffersView — deactivate Dialog flow', () => {
  it('clicking deactivate opens a confirm Dialog', () => {
    render(<MyOffersView />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const deactivateButtons = screen.getAllByRole('button', { name: /deactivate/i });
    fireEvent.click(deactivateButtons[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/deactivate this offer\?/i)).toBeInTheDocument();
  });

  it('confirming deactivate calls useDeleteOffer().mutate(offerId)', async () => {
    render(<MyOffersView />);
    const deactivateButtons = screen.getAllByRole('button', { name: /deactivate/i });
    fireEvent.click(deactivateButtons[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click the confirm button inside the Dialog
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(mutateDelete).toHaveBeenCalledWith('offer-active'));
  });

  it('closing Dialog without confirming does NOT call mutateDelete', () => {
    render(<MyOffersView />);
    const deactivateButtons = screen.getAllByRole('button', { name: /deactivate/i });
    fireEvent.click(deactivateButtons[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click the cancel button
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mutateDelete).not.toHaveBeenCalled();
  });
});

// ─── Disabled-while-pending ────────────────────────────────────────────────────

describe('MyOffersView — disabled-while-pending', () => {
  it('all buttons disabled while toggle mutation is pending', () => {
    (useToggleOffer as any).mockReturnValue({
      mutate: mutateToggle,
      isPending: true,
      isError: false,
      error: null,
    });
    render(<MyOffersView />);
    const buttons = screen.getAllByRole('button');
    // All buttons should be disabled while any mutation is pending
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('all buttons disabled while delete mutation is pending', () => {
    (useDeleteOffer as any).mockReturnValue({
      mutate: mutateDelete,
      isPending: true,
      isError: false,
      error: null,
    });
    render(<MyOffersView />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});

// ─── Error surfacing ───────────────────────────────────────────────────────────

describe('MyOffersView — mutation error surfacing', () => {
  it('shows tError message when toggle mutation errors', () => {
    (useToggleOffer as any).mockReturnValue({
      mutate: mutateToggle,
      isPending: false,
      isError: true,
      error: { code: 'P2P_OFFER_NOT_FOUND', requestId: 'req-1' },
    });
    render(<MyOffersView />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('error:P2P_OFFER_NOT_FOUND');
  });

  it('shows tError message when delete mutation errors', () => {
    (useDeleteOffer as any).mockReturnValue({
      mutate: mutateDelete,
      isPending: false,
      isError: true,
      error: { code: 'P2P_OFFER_FORBIDDEN', requestId: 'req-2' },
    });
    render(<MyOffersView />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('error:P2P_OFFER_FORBIDDEN');
  });
});
