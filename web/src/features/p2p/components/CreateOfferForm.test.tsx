// web/src/features/p2p/components/CreateOfferForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// --- mocks must be hoisted before imports ---

const mutate = vi.fn();
const mutateAsync = vi.fn();

vi.mock('../queries', () => ({
  useCreateOffer: vi.fn(() => ({
    mutate,
    mutateAsync,
    isPending: false,
    isError: false,
    error: null,
  })),
  useCryptoCatalog: vi.fn(() => ({
    data: [{ id: 'c-btc', symbol: 'BTC', name: 'Bitcoin' }],
  })),
  usePaymentMethods: vi.fn(() => ({
    data: [
      { id: 'pm1', name: 'Bank Transfer', description: null, active: true },
      { id: 'pm2', name: 'Cash', description: null, active: true },
    ],
  })),
}));

// Mini en-catalog for keys this component uses.
const enCatalog: Record<string, string> = {
  'p2p.create.typeBuy': 'Buy',
  'p2p.create.typeSell': 'Sell',
  'p2p.create.crypto': 'Asset',
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

import { useCreateOffer, useCryptoCatalog, usePaymentMethods } from '../queries';
import { CreateOfferForm } from './CreateOfferForm';

// ---- helpers ----

function fillCommonFields({
  type = 'sell',
  min = '0.01',
  max = '1',
  price = '65000',
  fiat = 'USD',
} = {}) {
  // Select type
  const typeSelect = screen.getByLabelText(/asset/i)
    ? screen.queryByLabelText(/type|direction/i)
    : null;
  // Use radio or select for type
  const radios = screen.queryAllByRole('radio');
  if (radios.length > 0) {
    const target = radios.find(
      (r) => (r as HTMLInputElement).value === type,
    );
    if (target) fireEvent.click(target);
  } else {
    const sel = screen.queryByLabelText(/type/i);
    if (sel) fireEvent.change(sel, { target: { value: type } });
  }

  // crypto select — pick first option (c-btc)
  const cryptoSel = screen.getByLabelText(/asset/i);
  fireEvent.change(cryptoSel, { target: { value: 'c-btc' } });

  fireEvent.change(screen.getByLabelText(/min amount/i), { target: { value: min } });
  fireEvent.change(screen.getByLabelText(/max amount/i), { target: { value: max } });
  fireEvent.change(screen.getByLabelText(/unit price/i), { target: { value: price } });
  fireEvent.change(screen.getByLabelText(/fiat currency/i), { target: { value: fiat } });

  // select first payment method
  const pmSelect = screen.getByLabelText(/accepted payment methods/i);
  fireEvent.change(pmSelect, { target: { value: 'pm1' } });
}

// ---- tests ----

beforeEach(() => {
  vi.clearAllMocks();
  (useCreateOffer as any).mockReturnValue({
    mutate,
    mutateAsync,
    isPending: false,
    isError: false,
    error: null,
  });
  (useCryptoCatalog as any).mockReturnValue({
    data: [{ id: 'c-btc', symbol: 'BTC', name: 'Bitcoin' }],
  });
  (usePaymentMethods as any).mockReturnValue({
    data: [
      { id: 'pm1', name: 'Bank Transfer', description: null, active: true },
      { id: 'pm2', name: 'Cash', description: null, active: true },
    ],
  });
});

describe('CreateOfferForm', () => {
  // Test 1: sell type shows and requires direccionFiat; submit disabled until filled
  it('sell type shows direccionFiat field and submit is disabled until it is filled', () => {
    render(<CreateOfferForm onCreated={vi.fn()} />);

    // Set type to sell
    const radios = screen.queryAllByRole('radio');
    if (radios.length > 0) {
      const sellRadio = radios.find((r) => (r as HTMLInputElement).value === 'sell');
      if (sellRadio) fireEvent.click(sellRadio);
    } else {
      const typeSelect = screen.getByLabelText(/type|direction/i);
      fireEvent.change(typeSelect, { target: { value: 'sell' } });
    }

    // direccionFiat field should be visible for sell
    expect(screen.getByLabelText(/payment address/i)).toBeInTheDocument();

    // Fill all fields except direccionFiat
    const cryptoSel = screen.getByLabelText(/asset/i);
    fireEvent.change(cryptoSel, { target: { value: 'c-btc' } });
    fireEvent.change(screen.getByLabelText(/min amount/i), { target: { value: '0.01' } });
    fireEvent.change(screen.getByLabelText(/max amount/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/unit price/i), { target: { value: '65000' } });
    fireEvent.change(screen.getByLabelText(/fiat currency/i), { target: { value: 'USD' } });
    const pmSelect = screen.getByLabelText(/accepted payment methods/i);
    fireEvent.change(pmSelect, { target: { value: 'pm1' } });

    // Submit should be disabled because direccionFiat is empty
    expect(screen.getByRole('button', { name: /create offer/i })).toBeDisabled();

    // Fill direccionFiat
    fireEvent.change(screen.getByLabelText(/payment address/i), {
      target: { value: 'my-bank-account-123' },
    });

    // Now submit should be enabled
    expect(screen.getByRole('button', { name: /create offer/i })).toBeEnabled();
  });

  // Test 2: buy type hides direccionFiat
  it('buy type hides the direccionFiat field', () => {
    render(<CreateOfferForm onCreated={vi.fn()} />);

    // Set type to buy
    const radios = screen.queryAllByRole('radio');
    if (radios.length > 0) {
      const buyRadio = radios.find((r) => (r as HTMLInputElement).value === 'buy');
      if (buyRadio) fireEvent.click(buyRadio);
    } else {
      const typeSelect = screen.getByLabelText(/type|direction/i);
      fireEvent.change(typeSelect, { target: { value: 'buy' } });
    }

    // direccionFiat field should NOT be visible for buy
    expect(screen.queryByLabelText(/payment address/i)).not.toBeInTheDocument();
  });

  // Test 3: minAmount > maxAmount disables submit and shows advisory
  it('disables submit and shows advisory when minAmount exceeds maxAmount', () => {
    render(<CreateOfferForm onCreated={vi.fn()} />);

    // Set to buy so direccionFiat is not required
    const radios = screen.queryAllByRole('radio');
    if (radios.length > 0) {
      const buyRadio = radios.find((r) => (r as HTMLInputElement).value === 'buy');
      if (buyRadio) fireEvent.click(buyRadio);
    } else {
      const typeSelect = screen.getByLabelText(/type|direction/i);
      fireEvent.change(typeSelect, { target: { value: 'buy' } });
    }

    const cryptoSel = screen.getByLabelText(/asset/i);
    fireEvent.change(cryptoSel, { target: { value: 'c-btc' } });
    // min > max
    fireEvent.change(screen.getByLabelText(/min amount/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/max amount/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/unit price/i), { target: { value: '65000' } });
    fireEvent.change(screen.getByLabelText(/fiat currency/i), { target: { value: 'USD' } });
    const pmSelect = screen.getByLabelText(/accepted payment methods/i);
    fireEvent.change(pmSelect, { target: { value: 'pm1' } });

    // Advisory message should appear
    expect(screen.getByText(/minimum amount cannot exceed the maximum/i)).toBeInTheDocument();
    // Submit disabled
    expect(screen.getByRole('button', { name: /create offer/i })).toBeDisabled();
  });

  // Test 4: valid sell submit calls mutation with canonical string money + metodosPagoIds + direccionFiat
  it('valid sell submit calls mutation with canonical string money, metodosPagoIds array, and direccionFiat', async () => {
    mutateAsync.mockResolvedValue({ id: 'offer-1' } as any);
    const onCreated = vi.fn();
    render(<CreateOfferForm onCreated={onCreated} />);

    // Set type to sell
    const radios = screen.queryAllByRole('radio');
    if (radios.length > 0) {
      const sellRadio = radios.find((r) => (r as HTMLInputElement).value === 'sell');
      if (sellRadio) fireEvent.click(sellRadio);
    } else {
      const typeSelect = screen.getByLabelText(/type|direction/i);
      fireEvent.change(typeSelect, { target: { value: 'sell' } });
    }

    const cryptoSel = screen.getByLabelText(/asset/i);
    fireEvent.change(cryptoSel, { target: { value: 'c-btc' } });
    fireEvent.change(screen.getByLabelText(/min amount/i), { target: { value: '0.01' } });
    fireEvent.change(screen.getByLabelText(/max amount/i), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText(/unit price/i), { target: { value: '65000.50' } });
    fireEvent.change(screen.getByLabelText(/fiat currency/i), { target: { value: 'usd' } }); // lowercase → uppercased
    const pmSelect = screen.getByLabelText(/accepted payment methods/i);
    fireEvent.change(pmSelect, { target: { value: 'pm1' } });
    fireEvent.change(screen.getByLabelText(/payment address/i), {
      target: { value: 'acct-xyz-123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /create offer/i }));

    // mutateAsync (or mutate) called with canonical string money
    await vi.waitFor(() => {
      const fn = mutateAsync.mock.calls.length > 0 ? mutateAsync : mutate;
      const calls = fn === mutateAsync ? mutateAsync.mock.calls : mutate.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const arg = calls[0][0];
      expect(arg.type).toBe('sell');
      expect(arg.cryptoId).toBe('c-btc');
      // Canonical decimal strings — no Number/parseFloat
      expect(arg.minAmount).toBe('0.01');
      expect(arg.maxAmount).toBe('1.5');
      expect(arg.unitPrice).toBe('65000.5'); // parseInput normalizes
      expect(arg.fiatCurrency).toBe('USD'); // uppercased
      expect(Array.isArray(arg.metodosPagoIds)).toBe(true);
      expect(arg.metodosPagoIds).toContain('pm1');
      expect(arg.direccionFiat).toBe('acct-xyz-123');
    });
  });
});
