'use client';

import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useMyBalances } from '../queries';
import type { BalanceEntry } from '../types';
import styles from './wallet.module.css';

function fmt(amount: string, locale: string): string {
  return formatDisplay(amount, { locale, maxDecimals: 8, minDecimals: 2 });
}

export default function BalancesView() {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError } = useMyBalances();

  if (isLoading) return <p>{t('common.loading')}</p>;
  if (isError) return <p role="alert">{t('wallet.balances.empty')}</p>;

  const entries: BalanceEntry[] = data ?? [];
  if (entries.length === 0) return <p className={styles.empty}>{t('wallet.balances.empty')}</p>;

  return (
    <div className={styles.panel}>
      {entries.map((e) => {
        const symbol = e.crypto?.symbol ?? e.criptomonedaId;
        return (
          <div className={styles.row} key={e.criptomonedaId}>
            <span className={styles.symbol}>{symbol}</span>
            <div className={styles.compartments}>
              <div className={styles.compartment}>
                <span className={styles.label}>{t('wallet.balances.funding')} · {t('wallet.balances.available')}</span>
                <span className={styles.amount}>{fmt(e.compartments.funding.available, locale)}</span>
                <span className={styles.label}>{t('wallet.balances.blocked')}</span>
                <span className={styles.amount}>{fmt(e.compartments.funding.blocked, locale)}</span>
                <span className={`${styles.label} ${styles.pending}`}>{t('wallet.balances.pending')}</span>
                <span className={`${styles.amount} ${styles.pending}`}>{fmt(e.compartments.funding.pending, locale)}</span>
              </div>
              <div className={styles.compartment}>
                <span className={styles.label}>{t('wallet.balances.spot')} · {t('wallet.balances.available')}</span>
                <span className={styles.amount}>{fmt(e.compartments.spot.available, locale)}</span>
                <span className={styles.label}>{t('wallet.balances.blocked')}</span>
                <span className={styles.amount}>{fmt(e.compartments.spot.blocked, locale)}</span>
              </div>
            </div>
          </div>
        );
      })}
      <p className={styles.hint}>{t('wallet.balances.pendingHint')}</p>
    </div>
  );
}
