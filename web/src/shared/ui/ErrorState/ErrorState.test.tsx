import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState, InlineError } from './ErrorState';

describe('ErrorState', () => {
  it('renders as an alert with title + message and fires retry', () => {
    const onRetry = vi.fn();
    render(<ErrorState title="No pudimos cargar tus saldos" message="Revisá tu conexión." onRetry={onRetry} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar tus saldos');
    expect(alert).toHaveTextContent('Revisá tu conexión.');
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('omits the retry button when no handler is given', () => {
    render(<ErrorState title="Algo salió mal" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('InlineError is an alert', () => {
    render(<InlineError>Dirección inválida</InlineError>);
    expect(screen.getByRole('alert')).toHaveTextContent('Dirección inválida');
  });
});
