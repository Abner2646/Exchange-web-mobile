import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Select, SelectOption } from './Select';

const OPTIONS: SelectOption[] = [
  { value: 'BTC', label: 'Bitcoin' },
  { value: 'ETH', label: 'Ethereum' },
  { value: 'SOL', label: 'Solana' },
];

function Harness({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Select
      aria-label="Moneda"
      options={OPTIONS}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

describe('Select (custom listbox)', () => {
  it('shows the placeholder until a value is chosen', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Moneda' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens on click and selects an option (fires onChange)', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Moneda' }));

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option')).toHaveLength(3);

    fireEvent.click(within(listbox).getByRole('option', { name: 'Ethereum' }));
    expect(onChange).toHaveBeenCalledWith('ETH');
    // Panel closes and the trigger shows the selected value (its a11y name stays
    // the field label "Moneda", since aria-label wins over content).
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Moneda' })).toHaveTextContent('Ethereum');
  });

  it('supports keyboard: ArrowDown to open/move, Enter to select', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: 'Moneda' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' }); // active: BTC -> ETH
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('ETH');
  });

  it('closes on Escape without selecting', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Moneda' }));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
