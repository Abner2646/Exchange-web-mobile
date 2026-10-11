'use client';

import { useMemo, useState } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Dialog } from '@/shared/ui';
import {
  useConfirmPayment,
  useCompleteTransaction,
  useCancelTransaction,
  useCryptoCatalog,
} from '../queries';
import type { Transaction } from '../types';
import styles from './p2p.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingAction = 'confirmPayment' | 'complete' | 'cancel' | null;

// ─── Component ────────────────────────────────────────────────────────────────

export function TransactionDetail({
  tx,
  currentUserId,
  onChanged,
}: {
  tx: Transaction;
  currentUserId: string;
  onChanged: (tx: Transaction) => void;
}) {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();

  // ── Role ──────────────────────────────────────────────────────────────────
  // Computed from the live tx prop — never trust a stale caller to gate actions.
  const isBuyer = tx.buyerId === currentUserId;
  const isSeller = tx.sellerId === currentUserId;

  // ── Mutation hooks ────────────────────────────────────────────────────────
  const confirmPayment = useConfirmPayment();
  const completeTransaction = useCompleteTransaction();
  const cancelTransaction = useCancelTransaction();

  // Any mutation in-flight → lock all buttons (no double-fire).
  const anyPending =
    confirmPayment.isPending || completeTransaction.isPending || cancelTransaction.isPending;

  // ── Action visibility (exact gating matrix) ───────────────────────────────
  const showConfirmPayment = isBuyer && tx.status === 'initiated';
  const showComplete = isSeller && tx.status === 'payment_confirmed';
  const showCancel =
    (isBuyer || isSeller) &&
    (tx.status === 'initiated' || tx.status === 'payment_confirmed');

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  function openDialog(action: PendingAction) {
    setPendingAction(action);
  }

  function closeDialog() {
    setPendingAction(null);
  }

  // ── Confirmed action handler ──────────────────────────────────────────────
  async function handleConfirmed() {
    if (!pendingAction) return;
    const action = pendingAction;
    closeDialog();

    try {
      let updated: Transaction;
      if (action === 'confirmPayment') {
        updated = await confirmPayment.mutateAsync(tx.id);
      } else if (action === 'complete') {
        updated = await completeTransaction.mutateAsync(tx.id);
      } else {
        updated = await cancelTransaction.mutateAsync(tx.id);
      }
      onChanged(updated);
    } catch {
      // error surfaced via isError / error below
    }
  }

  // ── Crypto symbol resolution ──────────────────────────────────────────────
  const { data: cryptos } = useCryptoCatalog();
  const symbol = useMemo(() => {
    const found = (cryptos ?? []).find((c) => c.id === tx.cryptoId);
    return found?.symbol ?? tx.crypto?.symbol ?? tx.cryptoId.slice(0, 8);
  }, [cryptos, tx.cryptoId, tx.crypto]);

  // ── Money display (formatDisplay only — no numeric ops) ───────────────────
  const cryptoDisplay = formatDisplay(tx.amount, {
    locale,
    maxDecimals: 8,
    stripTrailingZeros: true,
  });
  const fiatDisplay = formatDisplay(tx.fiatAmount, {
    locale,
    maxDecimals: 2,
    stripTrailingZeros: false,
  });

  // ── Active error (first non-null from any mutation) ───────────────────────
  const activeError =
    (confirmPayment.isError && confirmPayment.error) ||
    (completeTransaction.isError && completeTransaction.error) ||
    (cancelTransaction.isError && cancelTransaction.error) ||
    null;

  // ── Dialog prompt text ────────────────────────────────────────────────────
  const dialogTitle = pendingAction
    ? {
        confirmPayment: t('p2p.action.confirmPayment'),
        complete: t('p2p.action.complete'),
        cancel: t('p2p.action.cancel'),
      }[pendingAction]
    : '';

  const dialogPrompt = pendingAction
    ? {
        confirmPayment: t('p2p.action.confirmPaymentPrompt'),
        complete: t('p2p.action.completePrompt'),
        cancel: t('p2p.action.cancelPrompt'),
      }[pendingAction]
    : '';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <section className={styles.panel}>
      {/* ── State-machine progress ── */}
      <div className={styles.txStatus} aria-label="transaction status">
        <span>{t(`p2p.status.${tx.status}`)}</span>
      </div>

      {/* ── Money summary ── */}
      <div className={styles.label}>
        <span>
          {cryptoDisplay} {symbol}
        </span>
        {' · '}
        <span>
          {fiatDisplay} {tx.fiatCurrency}
        </span>
      </div>

      {/* ── Role hint ── */}
      {isBuyer && (
        <p className={styles.label}>{t('p2p.action.roleHintBuyer')}</p>
      )}
      {isSeller && (
        <p className={styles.label}>{t('p2p.action.roleHintSeller')}</p>
      )}

      {/* ── Mutation error ── */}
      {activeError && (
        <p role="alert" className={styles.error}>
          {tError(
            (activeError as { code?: string }).code ?? 'FALLBACK_UNKNOWN_ERROR',
            { requestId: (activeError as { requestId?: string }).requestId ?? '' },
          )}
        </p>
      )}

      {/* ── Action buttons ── */}
      {(showConfirmPayment || showComplete || showCancel) && (
        <div className={styles.actions}>
          {showConfirmPayment && (
            <Button
              onClick={() => openDialog('confirmPayment')}
              disabled={anyPending}
              loading={confirmPayment.isPending}
            >
              {t('p2p.action.confirmPayment')}
            </Button>
          )}

          {showComplete && (
            <Button
              onClick={() => openDialog('complete')}
              disabled={anyPending}
              loading={completeTransaction.isPending}
            >
              {t('p2p.action.complete')}
            </Button>
          )}

          {showCancel && (
            <Button
              variant="danger"
              onClick={() => openDialog('cancel')}
              disabled={anyPending}
              loading={cancelTransaction.isPending}
            >
              {t('p2p.action.cancel')}
            </Button>
          )}
        </div>
      )}

      {/* ── Confirm Dialog ── */}
      <Dialog
        isOpen={pendingAction !== null}
        onClose={closeDialog}
        title={dialogTitle}
        closeOnClickOutside={false}
      >
        <p>{dialogPrompt}</p>
        <div className={styles.actions}>
          <Button onClick={handleConfirmed} loading={anyPending} disabled={anyPending}>
            {t('common.submit')}
          </Button>
          <Button variant="secondary" onClick={closeDialog} disabled={anyPending}>
            {t('common.cancel')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
