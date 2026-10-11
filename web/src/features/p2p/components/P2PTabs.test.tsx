import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Stub the child feature components so this test exercises only the tab shell.
vi.mock('./OffersList', () => ({ OffersList: () => <div>stub-OffersList</div> }));
vi.mock('./OfferDetail', () => ({ OfferDetail: () => <div>stub-OfferDetail</div> }));
vi.mock('./AcceptOfferForm', () => ({ AcceptOfferForm: () => <div>stub-AcceptOfferForm</div> }));
vi.mock('./MyTransactionsView', () => ({ MyTransactionsView: () => <div>stub-MyTransactionsView</div> }));
vi.mock('./TransactionDetail', () => ({ TransactionDetail: () => <div>stub-TransactionDetail</div> }));
vi.mock('./CreateOfferForm', () => ({ CreateOfferForm: () => <div>stub-CreateOfferForm</div> }));
vi.mock('./MyOffersView', () => ({ MyOffersView: () => <div>stub-MyOffersView</div> }));

vi.mock('@/shared/i18n', () => ({
  useTranslation: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('@/features/auth/queries', () => ({
  useCurrentUser: () => ({ data: { id: 'me-1' } }),
}));

import { P2PPage } from './P2PTabs';

beforeEach(() => vi.clearAllMocks());

describe('P2PPage tab shell', () => {
  it('renders the four tab labels', () => {
    render(<P2PPage />);
    expect(screen.getByRole('tab', { name: 'p2p.tab.browse' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'p2p.tab.myTransactions' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'p2p.tab.myOffers' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'p2p.tab.create' })).toBeInTheDocument();
  });

  it('defaults to the Browse panel', () => {
    render(<P2PPage />);
    expect(screen.getByText('stub-OffersList')).toBeInTheDocument();
    expect(screen.queryByText('stub-MyOffersView')).not.toBeInTheDocument();
  });

  it('switches to My offers when that tab is clicked', async () => {
    const user = userEvent.setup();
    render(<P2PPage />);
    await user.click(screen.getByRole('tab', { name: 'p2p.tab.myOffers' }));
    expect(screen.getByText('stub-MyOffersView')).toBeInTheDocument();
    expect(screen.queryByText('stub-OffersList')).not.toBeInTheDocument();
  });

  it('switches to Create when that tab is clicked', async () => {
    const user = userEvent.setup();
    render(<P2PPage />);
    await user.click(screen.getByRole('tab', { name: 'p2p.tab.create' }));
    expect(screen.getByText('stub-CreateOfferForm')).toBeInTheDocument();
  });

  it('switches to My transactions when that tab is clicked', async () => {
    const user = userEvent.setup();
    render(<P2PPage />);
    await user.click(screen.getByRole('tab', { name: 'p2p.tab.myTransactions' }));
    expect(screen.getByText('stub-MyTransactionsView')).toBeInTheDocument();
  });
});
