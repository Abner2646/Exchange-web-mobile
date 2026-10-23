import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LocaleProvider } from '@/shared/i18n';
import { GoogleSignInButton } from './GoogleSignInButton';

function renderBtn() {
  return render(<LocaleProvider><GoogleSignInButton /></LocaleProvider>);
}

const assign = vi.fn();
const original = window.location;

beforeEach(() => {
  assign.mockReset();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign } });
});
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: original });
});

describe('GoogleSignInButton', () => {
  it('is always visible with the Google label (redirect flow, no client-id gate)', () => {
    renderBtn();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('redirects to the backend Google OAuth endpoint on click', () => {
    renderBtn();
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(assign).toHaveBeenCalledWith('/api/auth/google');
  });
});
