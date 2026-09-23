import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders label', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('loading sets aria-busy and disables', () => {
    render(<Button loading>Loading...</Button>);
    const button = screen.getByRole('button', { name: /loading/i });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });

  it('onClick fires when enabled and not when disabled/loading', () => {
    const handleClick = jest.fn();
    const { rerender } = render(<Button onClick={handleClick}>Click</Button>);
    
    const button = screen.getByRole('button', { name: /click/i });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);

    rerender(<Button onClick={handleClick} disabled>Click</Button>);
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1); // Still 1

    rerender(<Button onClick={handleClick} loading>Click</Button>);
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1); // Still 1
  });
});
