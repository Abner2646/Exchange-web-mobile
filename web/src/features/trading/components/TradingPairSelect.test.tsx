// web/src/features/trading/components/TradingPairSelect.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('../queries', () => ({ usePairs: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import { usePairs } from '../queries';
import { TradingPairSelect } from './TradingPairSelect';

describe('TradingPairSelect', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lists pairs and calls onChange with the id (custom Select)', async () => {
    (usePairs as any).mockReturnValue({ data: [{ id: 'p1', symbol: 'BTC/USDT', baseSymbol: 'BTC', quoteSymbol: 'USDT', lastPrice: '65000' }], isLoading: false });
    const onChange = vi.fn();
    render(<TradingPairSelect value="" onChange={onChange} />);
    // Custom Select: open the trigger (aria-label), pick the option.
    await userEvent.click(screen.getByRole('button', { name: 'trading.pair' }));
    await userEvent.click(screen.getByRole('option', { name: /BTC\/USDT/ }));
    expect(onChange).toHaveBeenCalledWith('p1');
  });
});
