// web/src/features/p2p/components/CreateOfferForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// --- mocks must be hoisted before imports ---

const mutate = vi.fn();
const mutateAsync = vi.fn();

vi.mock('../queries', () => ({
  useCreateOffer: vi.fn(() => ({ mutate, mutateAsync, isPending: false, isError: false, error: null })),
  useCryptoCatalog: vi.fn(() => ({ data: [{ id: 'c-btc', symbol: 'BTC', name: 'Bitcoin' }] })),
  usePaymentMethods: vi.fn(() => ({
    data: [
      { id: 'pm1', name: 'Bank Transfer', description: null, active: true },
      { id: 'pm2', name: 'Cash', description: null, active: true },
    ],
  })),
}));

// Mini en-catalog for keys this component uses.
const enCatalog: Record<string, string> = {
  'p2p.create.typeLegend': 'I Want To',
  'p2p.create.typeBuy': 'Buy',
  'p2p.create.typeSell': 'Sell',
  'p2p.create.crypto': 'Asset',
  'p2p.create.cryptoPlaceholder': 'Select an asset',
  'p2p.create.min': 'Min amount',
  'p2p.create.max': 'Max amount',
  'p2p.create.unitPrice': 'Unit price',
  'p2p.create.fiatCurrency': 'Fiat currency',
  'p2p.create.paymentMethods': 'Accepted payment methods',
  'p2p.create.terms': 'Terms and instructions',
  'p2p.create.direccionFiat': 'Your payment address / account',
  'p2p.create.direccionFiatHelp': 'Buyers will send fiat to this address. Double-check before submitting.',
  'p2p.create.submit': 'Create offer',
  'p2p.create.minGtMax': 'Minimum amount cannot exceed the maximum.',
  'p2p.create.flashTitle': 'Offer Published',
  'p2p.create.flashDetail': 'Your offer is now live in the marketplace.',
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
// Keep real shared/ui so Field label→input association + the custom Select are real.

import { useCreateOffer, useCryptoCatalog, usePaymentMethods } from '../queries';
import { CreateOfferForm } from './CreateOfferForm';

// ---- helpers ----

function setType(type: 'buy' | 'sell') {
  const radios = screen.getAllByRole('radio');
  const target = radios.find((r) => (r as HTMLButtonElement).value === type);
  if (target) fireEvent.click(target);
}

function selectCrypto() {
  // Open the custom Select (trigger labelled "Asset") and pick the only option.
  fireEvent.click(screen.getByRole('button', { name: /^asset$/i }));
  fireEvent.click(screen.getByRole('option', { name: /BTC — Bitcoin/i }));
}

function pickMethod(name = 'Bank Transfer') {
  fireEvent.click(screen.getByRole('button', { name }));
}

function fillMoney({ min = '0.01', max = '1', price = '65000', fiat = 'USD' } = {}) {
  fireEvent.change(screen.getByLabelText(/min amount/i), { target: { value: min } });
  fireEvent.change(screen.getByLabelText(/max amount/i), { target: { value: max } });
  fireEvent.change(screen.getByLabelText(/unit price/i), { target: { value: price } });
  fireEvent.change(screen.getByLabelText(/fiat currency/i), { target: { value: fiat } });
}

// ---- tests ----

beforeEach(() => {
  vi.clearAllMocks();
  (useCreateOffer as any).mockReturnValue({ mutate, mutateAsync, isPending: false, isError: false, error: null });
  (useCryptoCatalog as any).mockReturnValue({ data: [{ id: 'c-btc', symbol: 'BTC', name: 'Bitcoin' }] });
  (usePaymentMethods as any).mockReturnValue({
    data: [
      { id: 'pm1', name: 'Bank Transfer', description: null, active: true },
      { id: 'pm2', name: 'Cash', description: null, active: true },
    ],
  });
});

describe('CreateOfferForm', () => {
  it('sell type shows direccionFiat field and submit is disabled until it is filled', () => {
    render(<CreateOfferForm onCreated={vi.fn()} />);

    setType('sell');
    // direccionFiat field should be visible for sell
    expect(screen.getByLabelText(/payment address/i)).toBeInTheDocument();

    selectCrypto();
    fillMoney();
    pickMethod();

    // Submit disabled because direccionFiat is empty
    expect(screen.getByRole('button', { name: /create offer/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/payment address/i), { target: { value: 'my-bank-account-123' } });

    // Now submit should be enabled
    expect(screen.getByRole('button', { name: /create offer/i })).toBeEnabled();
  });

  it('buy type hides the direccionFiat field', () => {
    render(<CreateOfferForm onCreated={vi.fn()} />);
    setType('buy');
    expect(screen.queryByLabelText(/payment address/i)).not.toBeInTheDocument();
  });

  it('disables submit and shows advisory when minAmount exceeds maxAmount', () => {
    render(<CreateOfferForm onCreated={vi.fn()} />);
    setType('buy');
    selectCrypto();
    fillMoney({ min: '2', max: '1' });
    pickMethod();

    expect(screen.getByText(/minimum amount cannot exceed the maximum/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create offer/i })).toBeDisabled();
  });

  it('valid sell submit calls mutation with canonical string money, metodosPagoIds array, and direccionFiat', async () => {
    mutateAsync.mockResolvedValue({ id: 'offer-1' } as any);
    const onCreated = vi.fn();
    render(<CreateOfferForm onCreated={onCreated} />);

    setType('sell');
    selectCrypto();
    fillMoney({ min: '0.01', max: '1.5', price: '65000.50', fiat: 'usd' });
    pickMethod();
    fireEvent.change(screen.getByLabelText(/payment address/i), { target: { value: 'acct-xyz-123' } });

    fireEvent.click(screen.getByRole('button', { name: /create offer/i }));

    await vi.waitFor(() => {
      expect(mutateAsync.mock.calls.length).toBeGreaterThan(0);
      const arg = mutateAsync.mock.calls[0][0];
      expect(arg.type).toBe('sell');
      expect(arg.cryptoId).toBe('c-btc');
      // Canonical decimal strings — no Number/parseFloat; rounded to backend precision.
      expect(arg.minAmount).toBe('0.01');
      expect(arg.maxAmount).toBe('1.5');
      expect(arg.unitPrice).toBe('65000.5'); // price DECIMAL(10,4), parseInput normalizes
      expect(arg.fiatCurrency).toBe('USD'); // uppercased
      expect(Array.isArray(arg.metodosPagoIds)).toBe(true);
      expect(arg.metodosPagoIds).toContain('pm1');
      expect(arg.direccionFiat).toBe('acct-xyz-123');
    });
  });
});
