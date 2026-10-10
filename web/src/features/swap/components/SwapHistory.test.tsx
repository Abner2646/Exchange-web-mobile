import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('../queries', () => ({
  useMySwaps: vi.fn(),
  usePairs: vi.fn(() => ({ data: [] })),
}));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
vi.mock('@/shared/i18n/errorCatalog', () => ({ useErrorTranslation: () => ({ tError: (c: string) => c }) }));

import { useMySwaps } from '../queries';
import SwapHistory from './SwapHistory';

describe('SwapHistory', () => {
  beforeEach(() => vi.clearAllMocks());
  it('shows empty state', () => {
    (useMySwaps as any).mockReturnValue({ data: [], isLoading: false, isError: false });
    render(<SwapHistory />);
    expect(screen.getByText('swap.history.empty')).toBeInTheDocument();
  });
  it('renders a swap row', () => {
    (useMySwaps as any).mockReturnValue({
      data: [{ id: 's1', pairId: 'p1', type: 'buy', baseAmount: '0.5', quoteAmount: '32500', price: '65000', feeAmount: '32.5', status: 'completed' }],
      isLoading: false, isError: false,
    });
    render(<SwapHistory />);
    expect(screen.getByText('swap.form.buy')).toBeInTheDocument();
  });
  it('shows error state', () => {
    (useMySwaps as any).mockReturnValue({ data: undefined, isLoading: false, isError: true });
    render(<SwapHistory />);
    expect(screen.getByText('swap.history.error')).toBeInTheDocument();
  });
});
