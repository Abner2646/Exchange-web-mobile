import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoinLogo } from './CoinLogo';

describe('CoinLogo', () => {
  it('renders the coin image by default', () => {
    const { container } = render(<CoinLogo symbol="BTC" />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toContain('bitcoin');
  });

  it('falls back to a monogram when the image fails to load', () => {
    const { container } = render(<CoinLogo symbol="WXYZ" />);
    const img = container.querySelector('img')!;
    fireEvent.error(img);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('WXY')).toBeInTheDocument();
  });
});
