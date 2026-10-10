// web/src/features/swap/components/PairSelect.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

vi.mock('../queries', () => ({ usePairs: vi.fn() }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import { usePairs } from '../queries';
import { PairSelect } from './PairSelect';

describe('PairSelect', () => {
  beforeEach(() => vi.clearAllMocks());
  it('lists pairs and calls onChange with the pair id', async () => {
    (usePairs as any).mockReturnValue({
      data: [
        { id: 'p1', baseSymbol: 'BTC', quoteSymbol: 'USDT', oraclePaused: false },
        { id: 'p2', baseSymbol: 'ETH', quoteSymbol: 'USDT', oraclePaused: true },
      ],
      isLoading: false,
    });
    const onChange = vi.fn();
    render(<PairSelect value="" onChange={onChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'p1');
    expect(onChange).toHaveBeenCalledWith('p1');
    // the paused pair is present as an option
    expect(screen.getByRole('option', { name: /ETH\/USDT/ })).toBeInTheDocument();
  });
});
