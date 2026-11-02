'use client';

import { useTranslation } from '@/shared/i18n';
import { Skeleton } from '@/shared/ui';
import { useOrderBook } from '../queries';
import type { OrderBookEntry } from '../types';
import styles from './trading.module.css';

export function OrderBookView({ tradingPairId }: { tradingPairId: string }) {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError } = useOrderBook(tradingPairId, Boolean(tradingPairId));
  // Market-data display only: these are backend numbers, never the user's spend.
  const num = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(n);

  const body = () => {
    if (!tradingPairId) return <p className={styles.note}>{t('trading.selectPair')}</p>;
    if (isLoading) return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={18} />)}</div>;
    if (isError) return <p role="alert" className={styles.alert}>{t('trading.book.error')}</p>;
    if (!data || (data.bids.length === 0 && data.asks.length === 0)) return <p className={styles.note}>{t('trading.book.empty')}</p>;

    const maxTotal = Math.max(1, ...data.asks.map((e) => e.total), ...data.bids.map((e) => e.total));
    const bestBid = data.bids[0]?.price;
    const bestAsk = data.asks[0]?.price;
    // Guard a crossed book: never render a negative spread.
    const spread = bestBid != null && bestAsk != null ? Math.abs(bestAsk - bestBid) : null;

    const rows = (entries: OrderBookEntry[], priceCls: string, depthCls: string) =>
      entries.map((e, i) => (
        <tr className={styles.bookRow} key={`${priceCls}-${i}`}>
          <td><span className={styles.depth + ' ' + depthCls} style={{ width: `${Math.min(100, (e.total / maxTotal) * 100)}%` }} /><span className={priceCls}>{num(e.price)}</span></td>
          <td><span>{num(e.quantity)}</span></td>
          <td><span>{num(e.total)}</span></td>
        </tr>
      ));

    return (
      <>
        <table className={styles.bookTable}>
          <thead><tr><th>{t('trading.book.price')}</th><th>{t('trading.book.amount')}</th><th>{t('trading.book.total')}</th></tr></thead>
          {/* Best 12 asks, reversed so the best (lowest) ask sits at the bottom by the spread. */}
          <tbody>{rows([...data.asks].slice(0, 12).reverse(), styles.askPrice, styles.askDepth)}</tbody>
        </table>
        {spread != null && (
          <div className={styles.spreadRow}>
            <span>{t('trading.book.spread')}</span>
            <strong>{num(spread)}</strong>
          </div>
        )}
        <table className={styles.bookTable}>
          <tbody>{rows(data.bids.slice(0, 12), styles.bidPrice, styles.bidDepth)}</tbody>
        </table>
      </>
    );
  };

  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{t('trading.book.title')}</h2>
      {body()}
    </section>
  );
}
