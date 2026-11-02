import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('./OrderForm', () => ({ default: () => <div>form-stub</div> }));
vi.mock('./MyOrdersView', () => ({ default: () => <div>orders-stub</div> }));
vi.mock('./OrderBookView', () => ({ OrderBookView: () => <div>book-stub</div> }));
vi.mock('./RecentTradesView', () => ({ RecentTradesView: () => <div>trades-stub</div> }));
vi.mock('./TradingPairSelect', () => ({ TradingPairSelect: () => <div>pair-stub</div> }));
vi.mock('../queries', () => ({ usePairs: () => ({ data: [] }) }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import TradingWidget from './TradingWidget';

describe('TradingWidget', () => {
  it('renders the heading, pair picker, book, trades, form and orders (single pair selector)', () => {
    render(<TradingWidget />);
    expect(screen.getByRole('heading', { name: 'trading.title' })).toBeInTheDocument();
    expect(screen.getByText('pair-stub')).toBeInTheDocument();
    // The book/trades panels now always render (they own their empty state), driven by
    // the single pair selector — no second selector in the form.
    expect(screen.getByText('book-stub')).toBeInTheDocument();
    expect(screen.getByText('trades-stub')).toBeInTheDocument();
    expect(screen.getByText('form-stub')).toBeInTheDocument();
    expect(screen.getByText('orders-stub')).toBeInTheDocument();
  });
});
