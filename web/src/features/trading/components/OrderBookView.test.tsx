// web/src/features/trading/components/OrderBookView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import { OrderBookView } from './OrderBookView';

const PAIR = { lastPrice: '65000', pricePrecision: 2, quantityPrecision: 6 } as any;

describe('OrderBookView (synthetic, display-only)', () => {
  it('renders a book + spread around the pair last price', () => {
    render(<OrderBookView pair={PAIR} />);
    expect(screen.getByText('trading.book.title')).toBeInTheDocument();
    expect(screen.getByText('trading.book.spread')).toBeInTheDocument();
    // Two ladders (asks + bids).
    expect(screen.getAllByRole('table').length).toBeGreaterThanOrEqual(2);
  });

  it('shows the pick-a-pair note when there is no price', () => {
    render(<OrderBookView />);
    expect(screen.getByText('trading.selectPair')).toBeInTheDocument();
  });
});
