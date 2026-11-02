// web/src/features/trading/components/RecentTradesView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import { RecentTradesView } from './RecentTradesView';

const PAIR = { lastPrice: '65000', pricePrecision: 2, quantityPrecision: 6 } as any;

describe('RecentTradesView (synthetic, display-only)', () => {
  it('renders a synthetic tape around the pair last price', () => {
    render(<RecentTradesView pair={PAIR} />);
    expect(screen.getByText('trading.trades.title')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('shows the pick-a-pair note when there is no price', () => {
    render(<RecentTradesView />);
    expect(screen.getByText('trading.selectPair')).toBeInTheDocument();
  });
});
