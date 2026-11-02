import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./PriceChart', () => ({ default: () => <div>chart-stub</div> }));
vi.mock('./OrderForm', () => ({ default: () => <div>form-stub</div> }));
vi.mock('./MyOrdersView', () => ({ default: () => <div>orders-stub</div> }));
vi.mock('./OrderBookView', () => ({ OrderBookView: () => <div>book-stub</div> }));
vi.mock('./RecentTradesView', () => ({ RecentTradesView: () => <div>trades-stub</div> }));
vi.mock('./TradingPairSelect', () => ({ TradingPairSelect: () => <div>pair-stub</div> }));
vi.mock('../queries', () => ({ usePairs: () => ({ data: [] }) }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import TradingWidget from './TradingWidget';

describe('TradingWidget', () => {
  it('composes the terminal panels (chart + book + trades + form + orders)', () => {
    render(<TradingWidget />);
    // The pro terminal always shows the book/trades/form columns next to the chart
    // (single pair selector lives inside the chart panel).
    expect(screen.getByText('book-stub')).toBeInTheDocument();
    expect(screen.getByText('trades-stub')).toBeInTheDocument();
    expect(screen.getByText('form-stub')).toBeInTheDocument();
    expect(screen.getByText('orders-stub')).toBeInTheDocument();
  });
});
