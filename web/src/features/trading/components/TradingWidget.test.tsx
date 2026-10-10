import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
vi.mock('./OrderForm', () => ({ default: () => <div>form-stub</div> }));
vi.mock('./MyOrdersView', () => ({ default: () => <div>orders-stub</div> }));
vi.mock('./OrderBookView', () => ({ OrderBookView: () => <div>book-stub</div> }));
vi.mock('./RecentTradesView', () => ({ RecentTradesView: () => <div>trades-stub</div> }));
// Interactive stub so the test can select a pair and exercise the conditional market views.
vi.mock('./TradingPairSelect', () => ({
  TradingPairSelect: ({ onChange }: { onChange: (id: string) => void }) => (
    <button onClick={() => onChange('p1')}>select-pair</button>
  ),
}));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import TradingWidget from './TradingWidget';

describe('TradingWidget', () => {
  it('renders heading, form and orders; market views appear only after a pair is selected', async () => {
    render(<TradingWidget />);
    expect(screen.getByRole('heading', { name: 'trading.title' })).toBeInTheDocument();
    expect(screen.getByText('form-stub')).toBeInTheDocument();
    expect(screen.getByText('orders-stub')).toBeInTheDocument();
    // No pair selected yet → market data is hidden.
    expect(screen.queryByText('book-stub')).not.toBeInTheDocument();
    expect(screen.queryByText('trades-stub')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'select-pair' }));

    expect(screen.getByText('book-stub')).toBeInTheDocument();
    expect(screen.getByText('trades-stub')).toBeInTheDocument();
  });
});
