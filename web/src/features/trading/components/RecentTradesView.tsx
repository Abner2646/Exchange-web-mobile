'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { makeRecentTrades } from '../syntheticMarket';
import type { TradingPair } from '../types';
import styles from './trading.module.css';

export function RecentTradesView({ pair }: { pair?: TradingPair }) {
  const { t, locale } = useTranslation();
  const mid = Number(pair?.lastPrice ?? 0);
  const num = (n: number | string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(Number(n));
  const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString(locale) : '—');

  // Refresh so the tape looks alive (display only).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 4000);
    return () => clearInterval(id);
  }, []);
  const trades = useMemo(
    () => makeRecentTrades(mid, { pricePrecision: pair?.pricePrecision ?? 2, quantityPrecision: pair?.quantityPrecision ?? 6 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mid, tick, pair?.pricePrecision, pair?.quantityPrecision],
  );

  const body = () => {
    if (!mid) return <p className={styles.note}>{t('trading.selectPair')}</p>;
    if (trades.length === 0) return <p className={styles.note}>{t('trading.trades.empty')}</p>;
    return (
      <table className={styles.table}>
        <thead><tr><th>{t('trading.trades.price')}</th><th>{t('trading.trades.amount')}</th><th>{t('trading.trades.time')}</th></tr></thead>
        <tbody>
          {trades.map((tr) => (
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
