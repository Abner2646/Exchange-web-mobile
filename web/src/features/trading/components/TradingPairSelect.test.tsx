// web/src/features/trading/components/TradingPairSelect.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
vi.mock('../queries', () => ({ usePairs: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import { usePairs } from '../queries';
import { TradingPairSelect } from './TradingPairSelect';

describe('TradingPairSelect', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lists pairs and calls onChange with the id', async () => {
    (usePairs as any).mockReturnValue({ data: [{ id: 'p1', symbol: 'BTC/USDT', baseSymbol: 'BTC', quoteSymbol: 'USDT' }], isLoading: false });
    const onChange = vi.fn();
    render(<TradingPairSelect value="" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'p1');
    expect(onChange).toHaveBeenCalledWith('p1');
  });
});
