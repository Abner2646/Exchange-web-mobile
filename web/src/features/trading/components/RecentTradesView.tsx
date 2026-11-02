'use client';

import { useTranslation } from '@/shared/i18n';
import { Skeleton } from '@/shared/ui';
import { useRecentTrades } from '../queries';
import styles from './trading.module.css';

export function RecentTradesView({ tradingPairId }: { tradingPairId: string }) {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError } = useRecentTrades(tradingPairId, Boolean(tradingPairId));
  const num = (n: number | string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(Number(n));
  const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString(locale) : '—');

  const body = () => {
    if (!tradingPairId) return <p className={styles.note}>{t('trading.selectPair')}</p>;
    if (isLoading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={18} />)}</div>;
    if (isError) return <p role="alert" className={styles.alert}>{t('trading.trades.error')}</p>;
    const rows = data ?? [];
    if (rows.length === 0) return <p className={styles.note}>{t('trading.trades.empty')}</p>;
    return (
      <table className={styles.table}>
        <thead><tr><th>{t('trading.trades.price')}</th><th>{t('trading.trades.amount')}</th><th>{t('trading.trades.time')}</th></tr></thead>
        <tbody>
          {rows.map((tr) => (
            <tr key={tr.id}>
              <td className={`${styles.num} ${tr.side === 'buy' ? styles.buyText : styles.sellText}`}>{num(tr.price)}</td>
              <td className={styles.num}>{num(tr.quantity)}</td>
              <td>{time(tr.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{t('trading.trades.title')}</h2>
      {body()}
    </section>
  );
}
