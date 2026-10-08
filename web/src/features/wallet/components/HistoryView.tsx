'use client';

import { useState } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useTransactionHistory } from '../queries';
import type { WalletTxType, TransactionHistoryParams } from '../types';
import styles from './wallet.module.css';

export default function HistoryView() {
  const { t, locale } = useTranslation();
  const [filter, setFilter] = useState<'' | WalletTxType>('');
  const params: TransactionHistoryParams | undefined = filter ? { type: filter } : undefined;
  const { data, isLoading, isError } = useTransactionHistory(params);

  const rows = data ?? [];

  return (
    <div className={styles.panel}>
      <h2>{t('wallet.history.title')}</h2>

      <label htmlFor="history-filter" className={styles.label}>{t('wallet.history.type')}</label>
      <select id="history-filter" value={filter} onChange={(e) => setFilter(e.target.value as '' | WalletTxType)}>
        <option value="">{t('wallet.history.filterAll')}</option>
        <option value="deposit">{t('wallet.history.filterDeposit')}</option>
        <option value="withdrawal">{t('wallet.history.filterWithdrawal')}</option>
      </select>

      {isLoading && <p>{t('common.loading')}</p>}
      {isError && <p role="alert">{t('wallet.history.empty')}</p>}
      {!isLoading && !isError && rows.length === 0 && <p className={styles.empty}>{t('wallet.history.empty')}</p>}

      {rows.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('wallet.history.type')}</th>
              <th>{t('wallet.history.status')}</th>
              <th>{t('wallet.history.amount')}</th>
              <th>{t('wallet.history.confirmations')}</th>
              <th>{t('wallet.history.date')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tx) => (
              <tr key={tx.id}>
                <td>{tx.type}</td>
                <td>{tx.status}</td>
                <td className={styles.amount}>{formatDisplay(tx.amount, { locale, maxDecimals: 8, minDecimals: 2 })}</td>
                <td>{tx.confirmations}/{tx.requiredConfirmations}</td>
                <td>{new Date(tx.createdAt).toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
