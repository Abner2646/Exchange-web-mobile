import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home, { metadata } from './page';

// The shared <Navbar/> now lives in the root layout (so it appears on every page),
// not in the home itself — brand + sign-in live there and are covered by Navbar.test.
describe('public home', () => {
  it('renders the marketing headline', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/criptomonedas/i);
  });

  it('offers a register call to action (hero)', () => {
    render(<Home />);
    const links = screen.getAllByRole('link');
    expect(links.some((l) => l.getAttribute('href') === '/register')).toBe(true);
  });

  it('declares SEO metadata (title, description, canonical, openGraph)', () => {
    expect(metadata.title).toBeDefined();
    expect(metadata.description).toBeTruthy();
    expect(metadata.alternates?.canonical).toBe('/');
    expect(metadata.openGraph?.title).toBeTruthy();
  });
});
