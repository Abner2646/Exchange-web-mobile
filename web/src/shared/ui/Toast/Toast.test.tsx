import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastProvider';

function Trigger() {
  const { toast } = useToast();
  return (
    <button onClick={() => toast({ tone: 'success', title: 'Saved', message: 'All good', duration: 1000 })}>
      fire
    </button>
  );
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a toast on demand and auto-dismisses after the duration', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('dismisses manually via the close button', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('throws if useToast is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bare() {
      useToast();
      return null;
    }
    expect(() => render(<Bare />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
