import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs } from './Tabs';

const TABS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

function Harness({ onChange }: { onChange?: (id: string) => void }) {
  const [value, setValue] = useState('a');
  return (
    <Tabs
      tabs={TABS}
      value={value}
      aria-label="Example"
      onChange={(id) => {
        setValue(id);
        onChange?.(id);
      }}
    />
  );
}

describe('Tabs', () => {
  it('marks the active tab selected and only it is tabbable', () => {
    render(<Harness />);
    const alpha = screen.getByRole('tab', { name: 'Alpha' });
    const beta = screen.getByRole('tab', { name: 'Beta' });
    expect(alpha).toHaveAttribute('aria-selected', 'true');
    expect(alpha).toHaveAttribute('tabindex', '0');
    expect(beta).toHaveAttribute('tabindex', '-1');
  });

  it('selects on click', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves selection with arrow keys and wraps', () => {
    render(<Harness />);
    const alpha = screen.getByRole('tab', { name: 'Alpha' });
    fireEvent.keyDown(alpha, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Gamma' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
  });
});
