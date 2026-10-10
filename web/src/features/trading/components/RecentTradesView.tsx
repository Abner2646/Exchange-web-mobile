'use client';

import { useTranslation } from '@/shared/i18n';
import { useRecentTrades } from '../queries';
import styles from './trading.module.css';

export function RecentTradesView({ tradingPairId }: { tradingPairId: string }) {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError } = useRecentTrades(tradingPairId, Boolean(tradingPairId));
  const num = (n: number | string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(Number(n));

  if (isLoading) return <p className={styles.label}>{t('common.loading')}</p>;
  const rows = isError ? [] : (data ?? []);

  return (
    <section>
      <h2>{t('trading.trades.title')}</h2>
      {rows.length === 0 ? (
        <p className={styles.label}>{t('trading.trades.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead><tr><th>{t('trading.trades.price')}</th><th>{t('trading.trades.amount')}</th><th>{t('trading.trades.side')}</th></tr></thead>
          <tbody>
            {rows.map((tr) => (
              <tr key={tr.id}>
                <td className={tr.side === 'buy' ? styles.bid : styles.ask}>{num(tr.price)}</td>
                <td>{num(tr.quantity)}</td>
                <td>{t(tr.side === 'buy' ? 'trading.form.buy' : 'trading.form.sell')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
