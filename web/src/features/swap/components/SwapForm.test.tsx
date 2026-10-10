// web/src/features/swap/components/SwapForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mutateAsync = vi.fn();
vi.mock('../queries', () => ({
  usePairs: vi.fn(),
  useSwapQuote: vi.fn(),
  useCheckLimit: vi.fn(() => ({ data: undefined, isError: false, error: null })),
  useExecuteSwap: vi.fn(() => ({ mutateAsync, isPending: false, isError: false, isSuccess: false, error: null, data: undefined })),
}));
vi.mock('@/features/wallet/queries', () => ({ useMyBalances: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
vi.mock('@/shared/i18n/errorCatalog', () => ({ useErrorTranslation: () => ({ tError: (c: string) => c }) }));

import { usePairs, useSwapQuote, useExecuteSwap } from '../queries';
import { useMyBalances } from '@/features/wallet/queries';
import SwapForm from './SwapForm';

const PAIR = { id: 'p1', baseCryptoId: 'b1', quoteCryptoId: 'q1', currentPrice: '65000', feePercent: '0.1', active: true, oraclePaused: false, baseSymbol: 'BTC', quoteSymbol: 'USDT' };
const QUOTE = { par: { id: 'p1', base: 'BTC', quote: 'USDT', price: '65000' }, calculo: { baseAmount: '0.5', quoteAmount: '32500', feePercent: '0.1', feeAmount: '32.5', impactoSlippage: 0, finalAmount: '32532.5', direccion: 'buy', precioEfectivo: '65000' }, advertencias: [] };

function balances(available: string, which: 'q1' | 'b1') {
  return [{ criptomonedaId: which, compartments: { funding: { available, blocked: '0', pending: '0' }, spot: { available: '0', blocked: '0' } }, crypto: { id: which, symbol: which === 'q1' ? 'USDT' : 'BTC' } }];
}

beforeEach(() => {
  vi.clearAllMocks();
  (usePairs as any).mockReturnValue({ data: [PAIR], isLoading: false });
  (useSwapQuote as any).mockReturnValue({ data: QUOTE, error: null, isFetching: false, refetch: vi.fn() });
});

describe('SwapForm (money-path)', () => {
  it('blocks submit when the quote-asset Funding balance is insufficient for a buy', async () => {
    (useMyBalances as any).mockReturnValue({ data: balances('100', 'q1') }); // need 32532.5
    render(<SwapForm />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /swap.form.pair/i }).closest('select') ?? screen.getAllByRole('combobox')[0], 'p1');
    await userEvent.type(screen.getByLabelText('swap.form.amount'), '0.5');
    expect(screen.getByRole('button', { name: 'swap.form.submit' })).toBeDisabled();
    expect(screen.getByText('swap.form.insufficient')).toBeInTheDocument();
  });

  it('enables submit and executes when the quote-asset balance covers finalAmount', async () => {
    (useMyBalances as any).mockReturnValue({ data: balances('50000', 'q1') });
    mutateAsync.mockResolvedValue({ message: 'ok', data: { precioUsado: '65000', comisionCalculada: '32.5' } });
    render(<SwapForm />);
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'p1');
    await userEvent.type(screen.getByLabelText('swap.form.amount'), '0.5');
    const btn = screen.getByRole('button', { name: 'swap.form.submit' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(mutateAsync).toHaveBeenCalledWith({ pairId: 'p1', type: 'buy', baseAmount: '0.5', compartimento: 'funding' });
  });

  it('disables submit while the pair is oracle-paused', async () => {
    (usePairs as any).mockReturnValue({ data: [{ ...PAIR, oraclePaused: true }], isLoading: false });
    (useSwapQuote as any).mockReturnValue({ data: undefined, error: null, isFetching: false, refetch: vi.fn() });
    (useMyBalances as any).mockReturnValue({ data: balances('50000', 'q1') });
    render(<SwapForm />);
    await userEvent.selectOptions(screen.getAllByRole('combobox')[0], 'p1');
    await userEvent.type(screen.getByLabelText('swap.form.amount'), '0.5');
    expect(screen.getByRole('button', { name: 'swap.form.submit' })).toBeDisabled();
  });
});
