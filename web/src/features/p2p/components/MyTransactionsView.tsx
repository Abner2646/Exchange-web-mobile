'use client';

import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { Badge, CoinLogo, EmptyState, ErrorState, Skeleton } from '@/shared/ui';
import { useMyTransactions } from '../queries';
import type { Transaction, TxStatus } from '../types';
import styles from './p2p.module.css';

const PENDING_STATUSES: TxStatus[] = ['initiated', 'payment_confirmed'];

function isPending(status: TxStatus): boolean {
  return PENDING_STATUSES.includes(status);
}

function resolveSymbol(tx: Transaction): string {
  return tx.crypto?.symbol ?? tx.cryptoId.slice(0, 8);
}

const STATUS_TONE: Record<TxStatus, 'brand' | 'success' | 'error' | 'warning' | 'neutral'> = {
  initiated: 'warning',
  payment_confirmed: 'brand',
  completed: 'success',
  cancelled: 'neutral',
};

export function MyTransactionsView({ onSelect }: { onSelect: (tx: Transaction) => void }) {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError, refetch } = useMyTransactions();

  if (isLoading) {
    return (
      <div role="status" aria-label={t('common.loading')} className={styles.txList}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skelRow}>
            <Skeleton variant="circle" width={22} height={22} />
            <Skeleton variant="text" width="30%" />
            <Skeleton variant="text" width={80} />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState title={t('p2p.myTx.error')} onRetry={() => refetch()} retryLabel={t('common.retry')} />;
  }

  const rows = data?.transacciones ?? [];

  if (rows.length === 0) {
    return <EmptyState title={t('p2p.myTx.empty')} message={t('p2p.myTx.emptyHint')} />;
  }

  return (
    <section className={styles.txList}>
      {rows.map((tx) => {
        const pending = isPending(tx.status);
        const isBuyer = tx.esComprador === true;
        const counterparty = isBuyer ? (tx.seller?.username ?? '—') : (tx.buyer?.username ?? '—');
        const symbol = resolveSymbol(tx);
        const rowClass = [styles.txRow, pending ? styles.txPending : ''].filter(Boolean).join(' ');

        return (
          <button
            key={tx.id}
            type="button"
            className={rowClass}
            onClick={() => onSelect(tx)}
            aria-label={`${symbol} ${tx.amount} ${t(`p2p.status.${tx.status}`)}`}
          >
            <span className={styles.txCoin}>
              <CoinLogo symbol={symbol} size={22} />
              <span className={styles.coinSym}>{symbol}</span>
            </span>
            <span className={styles.txAmount}>
              {formatDisplay(tx.amount, { locale, maxDecimals: 8, stripTrailingZeros: true })} {symbol}
            </span>
            <span className={styles.txFiat}>
              {formatDisplay(tx.fiatAmount, { locale, maxDecimals: 2 })} {tx.fiatCurrency}
            </span>
            <span className={styles.txMeta}>
              <Badge tone={STATUS_TONE[tx.status]}>{t(`p2p.status.${tx.status}`)}</Badge>
              <Badge tone="neutral">{t(isBuyer ? 'p2p.myTx.buyer' : 'p2p.myTx.seller')}</Badge>
              <span className={styles.txCounterparty}>{counterparty}</span>
              <span className={styles.txDate}>{new Date(tx.created_at).toLocaleDateString(locale)}</span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
