// web/src/features/swap/components/QuoteDisplay.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
vi.mock('@/shared/i18n/errorCatalog', () => ({ useErrorTranslation: () => ({ tError: (c: string) => c }) }));
import { QuoteDisplay } from './QuoteDisplay';
import type { QuoteResponse } from '../types';

const quote: QuoteResponse = {
  par: { id: 'p1', base: 'BTC', quote: 'USDT', price: '65000' },
  calculo: { baseAmount: '0.5', quoteAmount: '32500', feePercent: '0.1', feeAmount: '32.5',
    impactoSlippage: 0, finalAmount: '32532.5', direccion: 'buy', precioEfectivo: '65000' },
  advertencias: [],
};

describe('QuoteDisplay', () => {
  it('shows the indicative disclosure and amounts for a buy', () => {
    render(<QuoteDisplay quote={quote} error={null} isFetching={false} type="buy" baseAmount="0.5" baseSymbol="BTC" quoteSymbol="USDT" onRetry={() => {}} />);
    expect(screen.getByText('swap.quote.indicative')).toBeInTheDocument();
    expect(screen.getByText('swap.quote.fee')).toBeInTheDocument();
  });
  it('shows the paused panel + retry on PRICE_ORACLE_DIVERGENCE', async () => {
    const onRetry = vi.fn();
    render(<QuoteDisplay quote={undefined} error={{ code: 'PRICE_ORACLE_DIVERGENCE', status: 503 } as any} isFetching={false} type="buy" baseAmount="0.5" baseSymbol="BTC" quoteSymbol="USDT" onRetry={onRetry} />);
    expect(screen.getByText('PRICE_ORACLE_DIVERGENCE')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'swap.form.pausedRetry' }));
    expect(onRetry).toHaveBeenCalled();
  });
  it('shows loading while fetching', () => {
    render(<QuoteDisplay quote={undefined} error={null} isFetching={true} type="buy" baseAmount="0.5" baseSymbol="BTC" quoteSymbol="USDT" onRetry={() => {}} />);
    expect(screen.getByText('swap.quote.loading')).toBeInTheDocument();
  });
});
