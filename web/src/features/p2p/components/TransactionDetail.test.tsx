// web/src/features/p2p/components/TransactionDetail.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mocks (hoisted before component import) ──────────────────────────────────

const mutateConfirm = vi.fn();
const mutateComplete = vi.fn();
const mutateCancel = vi.fn();

vi.mock('../queries', () => ({
  useConfirmPayment: vi.fn(() => ({
    mutate: mutateConfirm,
    mutateAsync: mutateConfirm,
    isPending: false,
    isError: false,
    error: null,
  })),
  useCompleteTransaction: vi.fn(() => ({
    mutate: mutateComplete,
    mutateAsync: mutateComplete,
    isPending: false,
    isError: false,
    error: null,
  })),
  useCancelTransaction: vi.fn(() => ({
    mutate: mutateCancel,
    mutateAsync: mutateCancel,
    isPending: false,
    isError: false,
    error: null,
  })),
  useCryptoCatalog: vi.fn(() => ({
    data: [{ id: 'c-btc', symbol: 'BTC', name: 'Bitcoin' }],
  })),
}));

const enCatalog: Record<string, string> = {
  'p2p.status.initiated': 'Initiated',
  'p2p.status.payment_confirmed': 'Payment confirmed',
  'p2p.status.completed': 'Completed',
  'p2p.status.cancelled': 'Cancelled',
  'p2p.action.confirmPayment': 'Confirm payment',
  'p2p.action.complete': 'Release funds',
  'p2p.action.cancel': 'Cancel transaction',
  'p2p.action.confirmPaymentPrompt': 'Confirm that you have sent the payment to the seller?',
  'p2p.action.completePrompt': 'Confirm that you received payment and release the funds to the buyer?',
  'p2p.action.cancelPrompt': 'Cancel this transaction? This cannot be undone.',
  'p2p.action.roleHintBuyer': 'You are the buyer. Send payment and confirm once done.',
  'p2p.action.roleHintSeller': 'You are the seller. Wait for the buyer to confirm payment, then release funds.',
  'common.submit': 'Confirm',
  'common.cancel': 'Close',
};

vi.mock('@/shared/i18n', () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, string | number>) => {
      const template = enCatalog[k] ?? k;
      if (!p) return template;
      return Object.entries(p).reduce(
        (s, [key, val]) => s.replace(new RegExp(`{{${key}}}`, 'g'), String(val)),
        template,
      );
    },
    locale: 'en',
  }),
}));

vi.mock('@/shared/i18n/errorCatalog', () => ({
  useErrorTranslation: () => ({
    tError: (code: string, params?: Record<string, string | number>) => {
      if (code === 'P2P_TX_INVALID_STATE') {
        return 'The transaction cannot proceed in its current state.';
      }
      if (code === 'P2P_TX_FORBIDDEN') {
        return 'You do not have permission to perform this action.';
      }
      return `error:${code}`;
    },
  }),
}));

// Keep real shared/ui (Button + Dialog) so rendering is real.

import { useConfirmPayment, useCompleteTransaction, useCancelTransaction, useCryptoCatalog } from '../queries';
import { TransactionDetail } from './TransactionDetail';
import type { Transaction } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BUYER_ID = 'user-buyer';
const SELLER_ID = 'user-seller';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    offerId: 'off-1',
    buyerId: BUYER_ID,
    sellerId: SELLER_ID,
    cryptoId: 'c-btc',
    amount: '0.5',
    unitPrice: '60000',
    fiatAmount: '30000',
    fiatCurrency: 'USD',
    paymentMethodId: 'pm-1',
    status: 'initiated',
    paymentConfirmedAt: null,
    completedAt: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    crypto: { id: 'c-btc', symbol: 'BTC', name: 'Bitcoin' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (useConfirmPayment as any).mockReturnValue({
    mutate: mutateConfirm,
    mutateAsync: mutateConfirm,
    isPending: false,
    isError: false,
    error: null,
  });
  (useCompleteTransaction as any).mockReturnValue({
    mutate: mutateComplete,
    mutateAsync: mutateComplete,
    isPending: false,
    isError: false,
    error: null,
  });
  (useCancelTransaction as any).mockReturnValue({
    mutate: mutateCancel,
    mutateAsync: mutateCancel,
    isPending: false,
    isError: false,
    error: null,
  });
  (useCryptoCatalog as any).mockReturnValue({
    data: [{ id: 'c-btc', symbol: 'BTC', name: 'Bitcoin' }],
  });
  mutateConfirm.mockResolvedValue(makeTx({ status: 'payment_confirmed' }));
  mutateComplete.mockResolvedValue(makeTx({ status: 'completed' }));
  mutateCancel.mockResolvedValue(makeTx({ status: 'cancelled' }));
});

// ─── Gating matrix tests ───────────────────────────────────────────────────────

describe('TransactionDetail — gating matrix', () => {
  it('buyer + initiated: shows confirm-payment and cancel, NOT complete', () => {
    render(
      <TransactionDetail
        tx={makeTx({ status: 'initiated' })}
        currentUserId={BUYER_ID}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /confirm payment/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel transaction/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /release funds/i })).not.toBeInTheDocument();
  });

  it('seller + initiated: shows cancel only (NOT confirm-payment, NOT complete)', () => {
    render(
      <TransactionDetail
        tx={makeTx({ status: 'initiated' })}
        currentUserId={SELLER_ID}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /confirm payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /release funds/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel transaction/i })).toBeInTheDocument();
  });

  it('buyer + payment_confirmed: shows cancel only (NOT confirm-payment, NOT complete)', () => {
    render(
      <TransactionDetail
        tx={makeTx({ status: 'payment_confirmed' })}
        currentUserId={BUYER_ID}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /confirm payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /release funds/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel transaction/i })).toBeInTheDocument();
  });

  it('seller + payment_confirmed: shows complete and cancel, NOT confirm-payment', () => {
    render(
      <TransactionDetail
        tx={makeTx({ status: 'payment_confirmed' })}
        currentUserId={SELLER_ID}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /release funds/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel transaction/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirm payment/i })).not.toBeInTheDocument();
  });

  it('completed: no action buttons rendered', () => {
    render(
      <TransactionDetail
        tx={makeTx({ status: 'completed' })}
        currentUserId={BUYER_ID}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /confirm payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /release funds/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel transaction/i })).not.toBeInTheDocument();
  });

  it('cancelled: no action buttons rendered', () => {
    render(
      <TransactionDetail
        tx={makeTx({ status: 'cancelled' })}
        currentUserId={SELLER_ID}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /confirm payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /release funds/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel transaction/i })).not.toBeInTheDocument();
  });

  it('third-party observer (neither buyer nor seller): no action buttons', () => {
    render(
      <TransactionDetail
        tx={makeTx({ status: 'initiated' })}
        currentUserId="user-observer"
        onChanged={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /confirm payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /release funds/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cancel transaction/i })).not.toBeInTheDocument();
  });
});

// ─── Dialog-confirm flow ───────────────────────────────────────────────────────

describe('TransactionDetail — Dialog confirm flow', () => {
  it('clicking complete opens a confirm Dialog; confirming fires useCompleteTransaction().mutate(tx.id)', async () => {
    const onChanged = vi.fn();
    render(
      <TransactionDetail
        tx={makeTx({ status: 'payment_confirmed' })}
        currentUserId={SELLER_ID}
        onChanged={onChanged}
      />,
    );

    // Dialog should not be open yet
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Click "Release funds"
    fireEvent.click(screen.getByRole('button', { name: /release funds/i }));

    // Dialog should now be open with the complete prompt
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/confirm that you received payment/i)).toBeInTheDocument();

    // Click the confirm button inside the Dialog
    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(mutateComplete).toHaveBeenCalledWith('tx-1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' })));
  });

  it('clicking confirm-payment opens a Dialog; confirming fires useConfirmPayment().mutate(tx.id)', async () => {
    const onChanged = vi.fn();
    render(
      <TransactionDetail
        tx={makeTx({ status: 'initiated' })}
        currentUserId={BUYER_ID}
        onChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /confirm payment/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/confirm that you have sent the payment/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    await waitFor(() => expect(mutateConfirm).toHaveBeenCalledWith('tx-1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ status: 'payment_confirmed' })));
  });

  it('clicking cancel opens a Dialog; confirming fires useCancelTransaction().mutate(tx.id)', async () => {
    const onChanged = vi.fn();
    render(
      <TransactionDetail
        tx={makeTx({ status: 'initiated' })}
        currentUserId={BUYER_ID}
        onChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel transaction/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/cancel this transaction/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    await waitFor(() => expect(mutateCancel).toHaveBeenCalledWith('tx-1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' })));
  });

  it('closing the Dialog without confirming does NOT fire the mutation', () => {
    render(
      <TransactionDetail
        tx={makeTx({ status: 'payment_confirmed' })}
        currentUserId={SELLER_ID}
        onChanged={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /release funds/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click the "Close" button
    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mutateComplete).not.toHaveBeenCalled();
  });
});

// ─── Disabled while any mutation pending ──────────────────────────────────────

describe('TransactionDetail — disabled-while-pending', () => {
  it('all buttons disabled while confirm-payment mutation is pending', () => {
    (useConfirmPayment as any).mockReturnValue({
      mutate: mutateConfirm,
      mutateAsync: mutateConfirm,
      isPending: true,
      isError: false,
      error: null,
    });

    render(
      <TransactionDetail
        tx={makeTx({ status: 'initiated' })}
        currentUserId={BUYER_ID}
        onChanged={vi.fn()}
      />,
    );

    // Both visible buttons should be disabled
    expect(screen.getByRole('button', { name: /confirm payment/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel transaction/i })).toBeDisabled();
  });

  it('all buttons disabled while cancel mutation is pending', () => {
    (useCancelTransaction as any).mockReturnValue({
      mutate: mutateCancel,
      mutateAsync: mutateCancel,
      isPending: true,
      isError: false,
      error: null,
    });

    render(
      <TransactionDetail
        tx={makeTx({ status: 'payment_confirmed' })}
        currentUserId={SELLER_ID}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /release funds/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel transaction/i })).toBeDisabled();
  });
});

// ─── Typed 4xx error surfacing ─────────────────────────────────────────────────

describe('TransactionDetail — typed 4xx error', () => {
  it('renders the tError message inline on P2P_TX_INVALID_STATE', () => {
    (useCompleteTransaction as any).mockReturnValue({
      mutate: mutateComplete,
      mutateAsync: mutateComplete,
      isPending: false,
      isError: true,
      error: { code: 'P2P_TX_INVALID_STATE', requestId: 'req-abc' },
    });

    render(
      <TransactionDetail
        tx={makeTx({ status: 'payment_confirmed' })}
        currentUserId={SELLER_ID}
        onChanged={vi.fn()}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.textContent).toContain('cannot proceed in its current state');
    // Must NOT show the raw code
    expect(alert.textContent).not.toContain('P2P_TX_INVALID_STATE');
  });

  it('renders tError message for P2P_TX_FORBIDDEN from confirm-payment', () => {
    (useConfirmPayment as any).mockReturnValue({
      mutate: mutateConfirm,
      mutateAsync: mutateConfirm,
      isPending: false,
      isError: true,
      error: { code: 'P2P_TX_FORBIDDEN', requestId: 'req-xyz' },
    });

    render(
      <TransactionDetail
        tx={makeTx({ status: 'initiated' })}
        currentUserId={BUYER_ID}
        onChanged={vi.fn()}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('permission to perform this action');
    expect(alert.textContent).not.toContain('P2P_TX_FORBIDDEN');
  });
});

// ─── Money display ─────────────────────────────────────────────────────────────

describe('TransactionDetail — money display', () => {
  it('shows the crypto amount and fiat amount using formatDisplay (no raw number ops)', () => {
    render(
      <TransactionDetail
        tx={makeTx({ amount: '0.5', fiatAmount: '30000', fiatCurrency: 'USD' })}
        currentUserId={BUYER_ID}
        onChanged={vi.fn()}
      />,
    );

    // BTC symbol resolved from useCryptoCatalog
    expect(screen.getByText(/BTC/i)).toBeInTheDocument();
    // Fiat currency
    expect(screen.getByText(/USD/i)).toBeInTheDocument();
  });

  it('falls back to tx.crypto.symbol when catalog has no match', () => {
    (useCryptoCatalog as any).mockReturnValue({ data: [] });

    render(
      <TransactionDetail
        tx={makeTx({ cryptoId: 'c-eth', crypto: { id: 'c-eth', symbol: 'ETH', name: 'Ethereum' } })}
        currentUserId={BUYER_ID}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText(/ETH/i)).toBeInTheDocument();
  });
});

// ─── Role hint ────────────────────────────────────────────────────────────────

describe('TransactionDetail — role hints', () => {
  it('shows buyer role hint when currentUserId is the buyer', () => {
    render(
      <TransactionDetail
        tx={makeTx({ status: 'initiated' })}
        currentUserId={BUYER_ID}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText(/you are the buyer/i)).toBeInTheDocument();
  });

  it('shows seller role hint when currentUserId is the seller', () => {
    render(
      <TransactionDetail
        tx={makeTx({ status: 'payment_confirmed' })}
        currentUserId={SELLER_ID}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText(/you are the seller/i)).toBeInTheDocument();
  });
});
