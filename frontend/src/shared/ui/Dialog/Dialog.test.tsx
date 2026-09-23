import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('is not rendered when closed', () => {
    render(
      <Dialog isOpen={false} onClose={() => {}} title="Test">
        Content
      </Dialog>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('when open has role="dialog"/aria-modal and focus moves into dialog', () => {
    render(
      <Dialog isOpen={true} onClose={() => {}} title="My Modal">
        Content
      </Dialog>
    );
    const dialog = screen.getByRole('dialog', { name: 'My Modal' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.activeElement).toBe(dialog);
  });

  it('Escape triggers onClose', () => {
    const handleClose = jest.fn();
    render(
      <Dialog isOpen={true} onClose={handleClose} title="My Modal">
        Content
      </Dialog>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
