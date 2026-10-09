import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home, { metadata } from './page';

describe('public home', () => {
  it('renders the marketing headline', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/BitFlow/i);
  });

  it('declares SEO metadata (title, description, canonical, openGraph)', () => {
    expect(metadata.title).toBeDefined();
    expect(metadata.description).toBeTruthy();
    expect(metadata.alternates?.canonical).toBe('/');
    expect(metadata.openGraph?.title).toBeTruthy();
  });
});
