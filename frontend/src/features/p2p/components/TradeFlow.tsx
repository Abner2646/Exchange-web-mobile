import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation, useErrorTranslation } from '../../../shared/i18n';
import { formatDisplay } from '../../../shared/money';
import { Dialog, Button } from '../../../shared/ui';
import { isApiError } from '../../../shared/api';
import { useUser } from '../../auth/queries';
import { 
  useTransaction, 
  useMarkPaymentSent, 
  useConfirmReceipt, 
  useOpenDispute, 
  useCancelTrade 
} from '../queries';
import styles from './TradeFlow.module.css';

export function TradeFlow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  
  const { data: user } = useUser();
  const { data: tx, isLoading, error } = useTransaction(id!);
  
  const markPayment = useMarkPaymentSent();
  const confirmReceipt = useConfirmReceipt();
  const dispute = useOpenDispute();
  const cancel = useCancelTrade();
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!tx || tx.status !== 'initiated') return;
    const end = new Date(tx.createdAt).getTime() + 15 * 60000;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      setTimeLeft(diff);
      if (diff === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [tx]);

  if (isLoading) return <div data-testid="loading-state">{t('Loading...')}</div>;
  if (error) {
    return (
      <div data-testid="error-state">
        {isApiError(error) ? tError(error.code) : tError('UNKNOWN_ERROR')}
      </div>
    );
  }
  if (!tx || !user) return null;

  const isBuyer = tx.buyerId === user.id;
  const isSeller = tx.sellerId === user.id;
  const isPending = markPayment.isLoading || confirmReceipt.isLoading || dispute.isLoading || cancel.isLoading;
  const anyError = markPayment.error || confirmReceipt.error || dispute.error || cancel.error;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className={styles.container}>
      <h2>{t('P2P Trade')}</h2>
      
      <div className={styles.details}>
        <p><strong>{t('Amount')}:</strong> {formatDisplay(tx.amount, { locale })} {tx.cryptoId}</p>
        <p><strong>{t('Status')}:</strong> <span data-testid="tx-status">{t(tx.status)}</span></p>
        {tx.status === 'initiated' && (
          <p><strong>{t('Time remaining')}:</strong> {formatTime(timeLeft)}</p>
        )}
      </div>

      {anyError && (
        <div data-testid="mutation-error" className={styles.error}>
          {isApiError(anyError) ? tError(anyError.code) : tError('UNKNOWN_ERROR')}
        </div>
      )}

      <div className={styles.actions}>
        {tx.status === 'initiated' && isBuyer && (
          <Button 
            onClick={() => markPayment.mutate(tx.id)} 
            disabled={isPending}
            data-testid="btn-mark-paid"
          >
            {t('I have paid')}
          </Button>
        )}

        {tx.status === 'payment_confirmed' && isSeller && (
          <Button 
            onClick={() => setIsConfirmOpen(true)} 
            disabled={isPending}
            data-testid="btn-release"
          >
            {t('I received payment, release crypto')}
          </Button>
        )}

        {(tx.status === 'initiated' || tx.status === 'payment_confirmed') && (
          <Button 
            onClick={() => cancel.mutate(tx.id)} 
            disabled={isPending}
            data-testid="btn-cancel"
            variant="secondary"
          >
            {t('Cancel')}
          </Button>
        )}

        {tx.status === 'payment_confirmed' && (
          <Button 
            onClick={() => dispute.mutate(tx.id)} 
            disabled={isPending}
            data-testid="btn-dispute"
            variant="secondary"
          >
            {t('Open Dispute')}
          </Button>
        )}
      </div>

      <Dialog 
        isOpen={isConfirmOpen} 
        onClose={() => setIsConfirmOpen(false)}
        title={t('Confirm Release')}
      >
        <p>{t('Are you sure you want to release the crypto? This action cannot be undone.')}</p>
        <div className={styles.dialogActions}>
          <Button onClick={() => setIsConfirmOpen(false)} disabled={isPending} variant="secondary">
            {t('Cancel')}
          </Button>
          <Button 
            onClick={() => {
              confirmReceipt.mutate(tx.id, {
                onSuccess: () => setIsConfirmOpen(false)
              });
            }}
            disabled={isPending}
            data-testid="btn-confirm-release"
          >
            {t('Confirm Release')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
