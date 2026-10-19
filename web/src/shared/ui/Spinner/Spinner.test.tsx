import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Spinner } from './Spinner';

describe('Spinner', () => {
  it('exposes an accessible status label', () => {
    render(<Spinner label="Cargando saldos" />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Cargando saldos');
  });

  it('defaults the label to "Cargando"', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
  });
});
