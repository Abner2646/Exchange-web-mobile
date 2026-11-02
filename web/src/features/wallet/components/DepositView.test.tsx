// web/src/features/wallet/components/DepositView.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider } from '@/shared/i18n';
import DepositView from './DepositView';

function setup() {
  return render(<LocaleProvider><DepositView /></LocaleProvider>);
}

describe('DepositView', () => {
  // Deposits are intentionally disabled (owner decision): the view is a region-unavailable
  // notice and must not wire the real deposit flow (no asset picker, no address).
  it('shows the region-unavailable notice', () => {
    setup();
    expect(screen.getByText(/unavailable in your region|no disponibles en tu región/i)).toBeInTheDocument();
  });

  it('does not render a deposit address flow', () => {
    setup();
    expect(screen.queryByText(/deposit address|dirección de depósito/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy|copiar/i })).not.toBeInTheDocument();
  });
});
