'use client';

import { useState } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { Badge, EmptyState, ErrorState, Skeleton, ClockIcon, ArrowDownIcon, ArrowUpIcon } from '@/shared/ui';
import type { BadgeTone } from '@/shared/ui';
import { useTransactionHistory } from '../queries';
import type { WalletTxType, WalletTxStatus, TransactionHistoryParams } from '../types';
import styles from './wallet.module.css';

const STATUS_TONE: Record<WalletTxStatus, BadgeTone> = {
  pending: 'warning',
  processing: 'brand',
  confirmed: 'success',
  completed: 'success',
  failed: 'error',
};

export default function HistoryView() {
  const { t, locale } = useTranslation();
  const [filter, setFilter] = useState<'' | WalletTxType>('');
  const params: TransactionHistoryParams | undefined = filter ? { type: filter } : undefined;
  const { data, isLoading, isError, refetch } = useTransactionHistory(params);

  const rows = data ?? [];

  const statusLabel = (s: WalletTxStatus) => {
    const key = `wallet.history.status${s.charAt(0).toUpperCase()}${s.slice(1)}`;
    const label = t(key);
    return label === key ? s : label;
  };
  const typeLabel = (type: WalletTxType) =>
    type === 'deposit' ? t('wallet.history.typeDeposit') : t('wallet.history.typeWithdrawal');

  const filters: { id: '' | WalletTxType; label: string }[] = [
    { id: '', label: t('wallet.history.filterAll') },
    { id: 'deposit', label: t('wallet.history.filterDeposit') },
    { id: 'withdrawal', label: t('wallet.history.filterWithdrawal') },
  ];

  return (
    <div className={styles.historyCard}>
      <div className={styles.historyHead}>
        <h2 className={styles.formTitle}>{t('wallet.history.title')}</h2>
        <div className={styles.filterPills} role="group" aria-label={t('wallet.history.type')}>
          {filters.map((f) => (
            <button
              key={f.id || 'all'}
              type="button"
              aria-pressed={filter === f.id}
              className={`${styles.pill} ${filter === f.id ? styles.pillActive : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className={styles.balanceList} aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={40} />
          ))}
        </div>
      )}

      {isError && (
        <ErrorState title={t('wallet.history.error')} onRetry={() => refetch()} retryLabel={t('common.retry')} />
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <EmptyState icon={<ClockIcon size={28} />} title={t('wallet.history.empty')} />
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('wallet.history.type')}</th>
              <th>{t('wallet.history.status')}</th>
              <th>{t('wallet.history.amount')}</th>
              <th className={styles.colConfirmations}>{t('wallet.history.confirmations')}</th>
              <th className={styles.colDate}>{t('wallet.history.date')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id}>
                <td>
                  <span className={styles.typeCell}>
                    {tx.type === 'deposit' ? <ArrowDownIcon size={15} /> : <ArrowUpIcon size={15} />}
                    {typeLabel(tx.type)}
                  </span>
                </td>
                <td><Badge tone={STATUS_TONE[tx.status] ?? 'neutral'}>{statusLabel(tx.status)}</Badge></td>
                <td className={styles.amountCell}>{formatDisplay(tx.amount, { locale, maxDecimals: 8, minDecimals: 2 })}</td>
                <td className={`${styles.confCell} ${styles.colConfirmations}`}>{tx.confirmations}/{tx.requiredConfirmations}</td>
                <td className={`${styles.dateCell} ${styles.colDate}`}>{new Date(tx.createdAt).toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
