'use client';

import { useMemo, useState } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import type { ApiError } from '@/shared/api';
import { Badge, Button, Dialog, useSuccessFlash } from '@/shared/ui';
import {
  useConfirmPayment,
  useCompleteTransaction,
  useCancelTransaction,
  useCryptoCatalog,
} from '../queries';
import type { Transaction, TxStatus } from '../types';
import styles from './p2p.module.css';

type PendingAction = 'confirmPayment' | 'complete' | 'cancel' | null;

// The happy-path state machine (cancelled is an off-path terminal state).
const STEPS: TxStatus[] = ['initiated', 'payment_confirmed', 'completed'];

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
  const { flash } = useSuccessFlash();

  // Role — computed from the live tx prop; never trust a stale caller to gate actions.
  const isBuyer = tx.buyerId === currentUserId;
  const isSeller = tx.sellerId === currentUserId;

  const confirmPayment = useConfirmPayment();
  const completeTransaction = useCompleteTransaction();
  const cancelTransaction = useCancelTransaction();

  const anyPending =
    confirmPayment.isPending || completeTransaction.isPending || cancelTransaction.isPending;

  // Action visibility (exact gating matrix).
  const showConfirmPayment = isBuyer && tx.status === 'initiated';
  const showComplete = isSeller && tx.status === 'payment_confirmed';
  const showCancel =
    (isBuyer || isSeller) && (tx.status === 'initiated' || tx.status === 'payment_confirmed');

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  async function handleConfirmed() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);

    try {
      let updated: Transaction;
      if (action === 'confirmPayment') {
        updated = await confirmPayment.mutateAsync(tx.id);
        flash({ title: t('p2p.action.flashConfirmTitle'), detail: t('p2p.action.flashConfirmDetail') });
      } else if (action === 'complete') {
        updated = await completeTransaction.mutateAsync(tx.id);
        flash({ title: t('p2p.action.flashReleaseTitle'), detail: t('p2p.action.flashReleaseDetail') });
      } else {
        updated = await cancelTransaction.mutateAsync(tx.id);
      }
      onChanged(updated);
    } catch {
      // error surfaced via isError / error below
    }
  }

  const { data: cryptos } = useCryptoCatalog();
  const symbol = useMemo(() => {
    const found = (cryptos ?? []).find((c) => c.id === tx.cryptoId);
    return found?.symbol ?? tx.crypto?.symbol ?? tx.cryptoId.slice(0, 8);
  }, [cryptos, tx.cryptoId, tx.crypto]);

  const cryptoDisplay = formatDisplay(tx.amount, { locale, maxDecimals: 8, stripTrailingZeros: true });
  const fiatDisplay = formatDisplay(tx.fiatAmount, { locale, maxDecimals: 2, stripTrailingZeros: false });

  const activeError: ApiError | null =
    confirmPayment.error ?? completeTransaction.error ?? cancelTransaction.error ?? null;

  const dialogTitle = pendingAction
    ? { confirmPayment: t('p2p.action.confirmPayment'), complete: t('p2p.action.complete'), cancel: t('p2p.action.cancel') }[pendingAction]
    : '';
  const dialogPrompt = pendingAction
    ? { confirmPayment: t('p2p.action.confirmPaymentPrompt'), complete: t('p2p.action.completePrompt'), cancel: t('p2p.action.cancelPrompt') }[pendingAction]
    : '';

  const cancelled = tx.status === 'cancelled';
  const currentIndex = STEPS.indexOf(tx.status);

  return (
    <section className={styles.form}>
      {/* State stepper */}
      <div className={styles.stepper} aria-label={t('p2p.detail.statusLabel')}>
        {STEPS.map((step, i) => {
          const done = !cancelled && i < currentIndex;
          const current = !cancelled && i === currentIndex;
          const cls = [
            styles.step,
            done ? styles.stepDone : '',
            current ? styles.stepCurrent : '',
            cancelled && i === 0 ? styles.stepCancelled : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={step} className={cls}>
              <span className={styles.stepDot}>{cancelled && i === 0 ? '×' : i + 1}</span>
              <span className={styles.stepLabel}>{t(`p2p.status.${step}`)}</span>
            </div>
          );
        })}
      </div>

      {/* Current status + money summary */}
      <div className={styles.summary}>
        <Badge tone={cancelled ? 'neutral' : statusTone(tx.status)}>
          {t(`p2p.status.${tx.status}`)}
        </Badge>
        <span className={styles.num}>{cryptoDisplay} {symbol}</span>
        <span>·</span>
        <span className={styles.num}>{fiatDisplay} {tx.fiatCurrency}</span>
      </div>

      {/* Role hint */}
      {isBuyer && <p className={styles.roleHint}>{t('p2p.action.roleHintBuyer')}</p>}
      {isSeller && <p className={styles.roleHint}>{t('p2p.action.roleHintSeller')}</p>}

      {/* Mutation error */}
      {activeError && (
        <p role="alert" className={styles.alert}>
          {tError(activeError.code ?? 'FALLBACK_UNKNOWN_ERROR', { requestId: activeError.requestId ?? '' })}
        </p>
      )}

      {/* Action buttons */}
      {(showConfirmPayment || showComplete || showCancel) && (
        <div className={styles.actions}>
          {showConfirmPayment && (
            <Button onClick={() => setPendingAction('confirmPayment')} disabled={anyPending} loading={confirmPayment.isPending}>
              {t('p2p.action.confirmPayment')}
            </Button>
          )}
          {showComplete && (
            <Button onClick={() => setPendingAction('complete')} disabled={anyPending} loading={completeTransaction.isPending}>
              {t('p2p.action.complete')}
            </Button>
          )}
          {showCancel && (
            <Button variant="danger" onClick={() => setPendingAction('cancel')} disabled={anyPending} loading={cancelTransaction.isPending}>
              {t('p2p.action.cancel')}
            </Button>
          )}
        </div>
      )}

      {/* Confirm Dialog */}
      <Dialog isOpen={pendingAction !== null} onClose={() => setPendingAction(null)} title={dialogTitle} closeOnClickOutside={false}>
        <p>{dialogPrompt}</p>
        <div className={styles.actions}>
          <Button onClick={handleConfirmed} loading={anyPending} disabled={anyPending}>
            {t('common.submit')}
          </Button>
          <Button variant="secondary" onClick={() => setPendingAction(null)} disabled={anyPending}>
            {t('common.cancel')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}

// Badge tone for the live status (completed=success, payment_confirmed=brand, initiated=warning).
function statusTone(status: TxStatus): 'brand' | 'success' | 'warning' | 'neutral' {
  if (status === 'completed') return 'success';
  if (status === 'payment_confirmed') return 'brand';
  if (status === 'initiated') return 'warning';
  return 'neutral';
}
