import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('./SwapForm', () => ({ default: () => <div>form-stub</div> }));
vi.mock('./SwapHistory', () => ({ default: () => <div>history-stub</div> }));
vi.mock('@/shared/i18n', () => ({ useTranslation: () => ({ t: (k: string) => k, locale: 'en' }) }));
import SwapWidget from './SwapWidget';

describe('SwapWidget', () => {
  it('renders the heading, form and history', () => {
    render(<SwapWidget />);
    expect(screen.getByRole('heading', { name: 'swap.title' })).toBeInTheDocument();
    expect(screen.getByText('form-stub')).toBeInTheDocument();
    expect(screen.getByText('history-stub')).toBeInTheDocument();
  });
});
