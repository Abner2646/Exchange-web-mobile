import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home, { metadata } from './page';

describe('public home', () => {
  it('renders the marketing headline and the BitFlow brand', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/custodial crypto exchange/i);
    expect(screen.getByText('BitFlow')).toBeInTheDocument();
  });

  it('offers register + sign-in calls to action', () => {
    render(<Home />);
    const register = screen.getAllByRole('link', { name: /create an account|get started/i });
    const signIn = screen.getAllByRole('link', { name: /sign in/i });
    expect(register.length).toBeGreaterThan(0);
    expect(register[0]).toHaveAttribute('href', '/register');
    expect(signIn[0]).toHaveAttribute('href', '/login');
  });

  it('declares SEO metadata (title, description, canonical, openGraph)', () => {
    expect(metadata.title).toBeDefined();
    expect(metadata.description).toBeTruthy();
    expect(metadata.alternates?.canonical).toBe('/');
    expect(metadata.openGraph?.title).toBeTruthy();
  });
});
