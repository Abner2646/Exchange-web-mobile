'use client';

import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
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

export function MyTransactionsView({ onSelect }: { onSelect: (tx: Transaction) => void }) {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError } = useMyTransactions();

  if (isLoading) return <p className={styles.label}>{t('common.loading')}</p>;

  if (isError) {
    return (
      <p role="alert" className={styles.error}>
        {t('p2p.myTx.error')}
      </p>
    );
  }

  const rows = data?.transacciones ?? [];

  if (rows.length === 0) {
    return <p className={styles.empty}>{t('p2p.myTx.empty')}</p>;
  }

  return (
    <section className={styles.panel}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('wallet.balances.crypto')}</th>
            <th>{t('wallet.history.amount')}</th>
            <th>{t('wallet.history.status')}</th>
            <th>{t('wallet.history.type')}</th>
            <th>{t('p2p.myTx.counterparty')}</th>
            <th>{t('p2p.myTx.date')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => {
            const pending = isPending(tx.status);
            const isBuyer = tx.esComprador === true;
            const counterparty = isBuyer
              ? (tx.seller?.username ?? '—')
              : (tx.buyer?.username ?? '—');
            const symbol = resolveSymbol(tx);
            const rowClass = [styles.txRow, pending ? styles.txPending : ''].filter(Boolean).join(' ');

            return (
              <tr key={tx.id}>
                <td colSpan={6} style={{ padding: 0, border: 'none' }}>
                  <button
                    type="button"
                    className={rowClass}
                    onClick={() => onSelect(tx)}
                    aria-label={`${symbol} ${tx.amount} ${tx.status}`}
                  >
                    <span className={styles.txCell}>{symbol}</span>
                    <span className={styles.txCell}>
                      {formatDisplay(tx.amount, { locale, maxDecimals: 8, stripTrailingZeros: true })}{' '}
                      {symbol}
                    </span>
                    <span className={styles.txCell}>
                      {formatDisplay(tx.fiatAmount, { locale, maxDecimals: 2 })}{' '}
                      {tx.fiatCurrency}
                    </span>
                    <span className={`${styles.txCell} ${styles.txStatus}`}>
                      {t(`p2p.status.${tx.status}`)}
                    </span>
                    <span className={`${styles.txCell} ${styles.txRole}`}>
                      {t(isBuyer ? 'p2p.myTx.buyer' : 'p2p.myTx.seller')}
                    </span>
                    <span className={styles.txCell}>{counterparty}</span>
                    <span className={styles.txCell}>
                      {new Date(tx.created_at).toLocaleDateString(locale)}
                    </span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
