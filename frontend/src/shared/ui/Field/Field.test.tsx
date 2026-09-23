import React from 'react';
import { render, screen } from '@testing-library/react';
import { Field } from './Field';

describe('Field', () => {
  it('label is associated to control', () => {
    render(<Field label="Username" />);
    const input = screen.getByRole('textbox', { name: /username/i });
    expect(input).toBeInTheDocument();
  });

  it('error sets aria-invalid and is referenced by aria-describedby', () => {
    render(<Field label="Email" error="Invalid email address" />);
    const input = screen.getByRole('textbox', { name: /email/i });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    
    const errorMsg = document.getElementById(describedBy?.split(' ')[0] || '');
    expect(errorMsg).toHaveTextContent('Invalid email address');
  });

  it('renders children if provided', () => {
    render(
      <Field label="Custom">
        <textarea data-testid="custom-input" />
      </Field>
    );
    const textarea = screen.getByTestId('custom-input');
    expect(textarea).toHaveAttribute('id');
    expect(textarea).toBe(screen.getByLabelText('Custom'));
  });
});
