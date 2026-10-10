import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
vi.mock('./OrderForm', () => ({ default: () => <div>form-stub</div> }));
vi.mock('./MyOrdersView', () => ({ default: () => <div>orders-stub</div> }));
vi.mock('./OrderBookView', () => ({ OrderBookView: () => <div>book-stub</div> }));
vi.mock('./RecentTradesView', () => ({ RecentTradesView: () => <div>trades-stub</div> }));
vi.mock('./TradingPairSelect', () => ({ TradingPairSelect: () => <div>pairselect-stub</div> }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import TradingWidget from './TradingWidget';

describe('TradingWidget', () => {
  it('renders heading, market data, form and orders', () => {
    render(<TradingWidget />);
    expect(screen.getByRole('heading', { name: 'trading.title' })).toBeInTheDocument();
    expect(screen.getByText('form-stub')).toBeInTheDocument();
    expect(screen.getByText('book-stub')).toBeInTheDocument();
    expect(screen.getByText('orders-stub')).toBeInTheDocument();
  });
});
