import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SuccessFlashProvider, useSuccessFlash, type FlashOptions } from './SuccessFlash';

function Trigger({ opts }: { opts: FlashOptions }) {
  const { flash } = useSuccessFlash();
  return <button onClick={() => flash(opts)}>go</button>;
}

describe('SuccessFlash', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the overlay on flash() and auto-dismisses after the duration', () => {
    render(
      <SuccessFlashProvider>
        <Trigger opts={{ title: 'Done!', detail: 'You swapped X for Y', duration: 1000 }} />
      </SuccessFlashProvider>,
    );
    act(() => { fireEvent.click(screen.getByText('go')); });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Done!')).toBeInTheDocument();
    expect(screen.getByText('You swapped X for Y')).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1000 + 600); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('dismisses early on click', () => {
    render(
      <SuccessFlashProvider>
        <Trigger opts={{ title: 'Done!' }} />
      </SuccessFlashProvider>,
    );
    act(() => { fireEvent.click(screen.getByText('go')); });
    act(() => { fireEvent.click(screen.getByRole('alert')); vi.advanceTimersByTime(600); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('useSuccessFlash is a no-op (does not throw) without a provider', () => {
    render(<Trigger opts={{ title: 'Done!' }} />);
    expect(() => act(() => { fireEvent.click(screen.getByText('go')); })).not.toThrow();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
