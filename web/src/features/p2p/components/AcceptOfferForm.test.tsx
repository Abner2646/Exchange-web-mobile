// web/src/features/p2p/components/AcceptOfferForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// --- mocks must be hoisted before imports of the modules they replace ---

const mutateAsync = vi.fn();

vi.mock('../queries', () => ({
  useAcceptOffer: vi.fn(() => ({ mutateAsync, isPending: false, isError: false, error: null })),
  useCryptoCatalog: vi.fn(() => ({ data: [{ id: 'c-btc', symbol: 'BTC', name: 'Bitcoin' }] })),
}));

vi.mock('@/features/wallet/queries', () => ({
  useMyBalances: vi.fn(),
}));

// Mini en-catalog for keys this component uses — enables interpolation smoke-test.
const enCatalog: Record<string, string> = {
  'p2p.accept.amountLabel': 'Amount ({{crypto}})',
  'p2p.accept.amountHint': 'Must be between {{min}} and {{max}} {{crypto}}.',
  'p2p.accept.fiatOwed': 'You will owe {{amount}} {{fiat}} to the seller.',
  'p2p.accept.youReceive': 'You receive',
  'p2p.accept.outOfRange': 'The amount must be between {{min}} and {{max}} {{crypto}}.',
  'p2p.accept.pickPaymentMethod': 'Select a payment method',
  'p2p.accept.submit': 'Accept offer',
  'p2p.accept.insufficientFunds': 'Insufficient funds.',
  'p2p.accept.loadingBalance': 'Checking balance…',
  'p2p.accept.sellerAddress': 'Seller payment address',
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
  useErrorTranslation: () => ({ tError: (c: string) => c }),
}));

// Keep real money module — money-path rules forbid mocking it.
// Keep real shared/ui so Field label→input association is real.

import { useAcceptOffer, useCryptoCatalog } from '../queries';
import { useMyBalances } from '@/features/wallet/queries';
import { AcceptOfferForm } from './AcceptOfferForm';

// ---- fixtures ----

const buyOffer = {
  id: 'o1',
  type: 'buy',
  cryptoId: 'c-btc',
  minAmount: '0.01',
  maxAmount: '2',
  unitPrice: '65000.0000',
  fiatCurrency: 'USD',
  direccionFiat: null,
  active: true,
  paymentMethods: [{ id: 'pm1', name: 'Bank', description: null, active: true }],
} as any;

const sellOffer = {
  ...buyOffer,
  id: 'o2',
  type: 'sell',
  direccionFiat: 'acct-xyz',
} as any;

// A BalanceEntry for c-btc with the given funding available amount.
function makeBalances(available: string) {
  return [
    {
      criptomonedaId: 'c-btc',
      compartments: {
        funding: { available, blocked: '0', pending: '0' },
        spot:    { available: '0', blocked: '0' },
      },
      crypto: { id: 'c-btc', symbol: 'BTC', name: 'Bitcoin' },
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: sell-offer tests (buyer role) need no balances gate; keep data loaded.
  (useMyBalances as any).mockReturnValue({ data: makeBalances('100') });
  (useAcceptOffer as any).mockReturnValue({ mutateAsync, isPending: false, isError: false, error: null });
});

// ---- helpers ----

function fillForm(amount: string, pmValue = 'pm1') {
  const amountInput = screen.getByLabelText(/amount/i);
  fireEvent.change(amountInput, { target: { value: amount } });
  const select = screen.getByLabelText(/select a payment method/i);
  fireEvent.change(select, { target: { value: pmValue } });
}

// ---- tests ----

describe('AcceptOfferForm money-path', () => {
  it('blocks submit when amount is below the offer minimum', () => {
    // buyOffer.minAmount = '0.01', entering '0.001' → out of range
    render(<AcceptOfferForm offer={buyOffer} onDone={vi.fn()} />);
    fillForm('0.001');
    expect(screen.getByRole('button', { name: /accept offer/i })).toBeDisabled();
    expect(screen.getByText(/amount must be between/i)).toBeInTheDocument();
  });

  it('as seller (buy offer), blocks submit when Funding balance is insufficient', () => {
    // buyOffer.type === 'buy' → acceptor is seller; lock requires crypto from seller.
    // Balance: 0.5 BTC available; entering 1 BTC → insufficient.
    (useMyBalances as any).mockReturnValue({ data: makeBalances('0.5') });
    render(<AcceptOfferForm offer={buyOffer} onDone={vi.fn()} />);
    fillForm('1');
    expect(screen.getByRole('button', { name: /accept offer/i })).toBeDisabled();
    expect(screen.getByText(/insufficient funds/i)).toBeInTheDocument();
  });

  it('as seller, blocks submit while the balance is still unknown', () => {
    // balances data = undefined → fundingAvailable null → cannot prove sufficiency.
    (useMyBalances as any).mockReturnValue({ data: undefined });
    render(<AcceptOfferForm offer={buyOffer} onDone={vi.fn()} />);
    fillForm('1');
    expect(screen.getByRole('button', { name: /accept offer/i })).toBeDisabled();
    expect(screen.getByText(/checking balance/i)).toBeInTheDocument();
  });

  it('as buyer (sell offer), no crypto gate — discloses fiat owed and seller address, submit enabled', () => {
    // sellOffer.type === 'sell' → acceptor is buyer; no crypto sufficiency check.
    // fiatOwed = multiply('1', '65000.0000') = '65000.0000'
    // direccionFiat = 'acct-xyz'
    render(<AcceptOfferForm offer={sellOffer} onDone={vi.fn()} />);
    fillForm('1');
    // Interpolated sentence "You will owe 65,000 USD to the seller." contains the number.
    expect(screen.getByText(/65,?000/)).toBeInTheDocument();
    expect(screen.getByText(/acct-xyz/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept offer/i })).toBeEnabled();
  });

  it('submits amount as the canonical string and disables while pending', () => {
    // sellOffer → buyer role, no balance gate. mutateAsync must be called with canonical string.
    mutateAsync.mockResolvedValue({ id: 'tx1' } as any);
    const { rerender } = render(<AcceptOfferForm offer={sellOffer} onDone={vi.fn()} />);
    fillForm('1.5');
    fireEvent.click(screen.getByRole('button', { name: /accept offer/i }));
    expect(mutateAsync).toHaveBeenCalledWith({
      offerId: 'o2',
      amount: '1.5',
      paymentMethodId: 'pm1',
    });

    // Re-render the SAME instance with isPending:true to verify disabled-while-pending.
    (useAcceptOffer as any).mockReturnValue({ mutateAsync, isPending: true, isError: false, error: null });
    rerender(<AcceptOfferForm offer={sellOffer} onDone={vi.fn()} />);
    expect(screen.getByRole('button', { name: /accept offer/i })).toBeDisabled();
  });

  it('as seller (buy offer), discloses fiat to receive', () => {
    // buyOffer.type === 'buy' → acceptor is seller; seller should see how much fiat they receive.
    // fiatOwed = multiply('1', '65000.0000') = '65000.0000'
    (useMyBalances as any).mockReturnValue({ data: makeBalances('100') });
    render(<AcceptOfferForm offer={buyOffer} onDone={vi.fn()} />);
    fillForm('1');
    // Seller disclosure: "You receive" key + fiat amount
    expect(screen.getByText(/you receive/i)).toBeInTheDocument();
    expect(screen.getByText(/65,?000/)).toBeInTheDocument();
  });
});
