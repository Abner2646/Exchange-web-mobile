// web/src/features/swap/components/SwapForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mutateAsync = vi.fn();
const reset = vi.fn();
vi.mock('../queries', () => ({
  usePairs: vi.fn(),
  useSwapQuote: vi.fn(),
  useExecuteSwap: vi.fn(() => ({ mutateAsync, reset, isPending: false, isError: false, isSuccess: false, error: null, data: undefined })),
}));
vi.mock('@/features/wallet/queries', () => ({ useMyBalances: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
vi.mock('@/shared/i18n/errorCatalog', () => ({ useErrorTranslation: () => ({ tError: (c: string) => c }) }));

import { usePairs, useSwapQuote, useExecuteSwap } from '../queries';
import { useMyBalances } from '@/features/wallet/queries';
import SwapForm from './SwapForm';

// b1=BTC (base), q1=USDT (quote). Defaults → From=USDT, To=BTC (a buy of BTC).
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

// The coins use the custom Select (button trigger + listbox), not a native <select>.
async function selectCoin(which: 'from' | 'to', symbol: RegExp) {
  await userEvent.click(screen.getByRole('button', { name: `swap.form.${which}` }));
  await userEvent.click(screen.getByRole('option', { name: symbol }));
}
const typeTo = (v: string) => userEvent.type(screen.getByLabelText('swap.form.toAmount'), v);
const typeFrom = (v: string) => userEvent.type(screen.getByLabelText('swap.form.fromAmount'), v);

describe('SwapForm (money-path)', () => {
  it('blocks submit when the From (spent) balance is insufficient for a buy', async () => {
    (useMyBalances as any).mockReturnValue({ data: balances('100', 'q1') }); // need 32532.5 USDT
    render(<SwapForm />);
    await typeTo('0.5'); // drive the To (BTC) field → baseAmount 0.5, a buy
    expect(screen.getByRole('button', { name: 'swap.form.submit' })).toBeDisabled();
    expect(screen.getByText('swap.form.insufficient')).toBeInTheDocument();
  });

  it('enables submit and executes a buy when the quote balance covers finalAmount', async () => {
    (useMyBalances as any).mockReturnValue({ data: balances('50000', 'q1') });
    mutateAsync.mockResolvedValue({ message: 'ok', data: { precioUsado: '65000', comisionCalculada: '32.5' } });
    render(<SwapForm />);
    await typeTo('0.5');
    const btn = screen.getByRole('button', { name: 'swap.form.submit' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(mutateAsync).toHaveBeenCalledWith({ pairId: 'p1', type: 'buy', baseAmount: '0.5', compartimento: 'funding' });
  });

  it('maps From=BTC/To=USDT to a sell and submits the base amount', async () => {
    (useMyBalances as any).mockReturnValue({ data: balances('1', 'b1') });
    mutateAsync.mockResolvedValue({ message: 'ok', data: { precioUsado: '65000', comisionCalculada: '32.5' } });
    render(<SwapForm />);
    await selectCoin('from', /BTC/); // choosing BTC as From clears To (was BTC)…
    await selectCoin('to', /USDT/); // …then pick USDT as To → a sell
    await typeFrom('0.5'); // drive the From (BTC) field → baseAmount 0.5
    const btn = screen.getByRole('button', { name: 'swap.form.submit' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    expect(mutateAsync).toHaveBeenCalledWith({ pairId: 'p1', type: 'sell', baseAmount: '0.5', compartimento: 'funding' });
  });

  it('disables submit while the pair is oracle-paused', async () => {
    (usePairs as any).mockReturnValue({ data: [{ ...PAIR, oraclePaused: true }], isLoading: false });
    (useSwapQuote as any).mockReturnValue({ data: undefined, error: null, isFetching: false, refetch: vi.fn() });
    (useMyBalances as any).mockReturnValue({ data: balances('50000', 'q1') });
    render(<SwapForm />);
    await typeTo('0.5');
    expect(screen.getByRole('button', { name: 'swap.form.submit' })).toBeDisabled();
    expect(screen.getByText('swap.form.paused')).toBeInTheDocument();
  });
});
