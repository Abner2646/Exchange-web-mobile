'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { makeOrderBook } from '../syntheticMarket';
import type { OrderBookEntry, TradingPair } from '../types';
import styles from './trading.module.css';

export function OrderBookView({ pair }: { pair?: TradingPair }) {
  const { t, locale } = useTranslation();
  const mid = Number(pair?.lastPrice ?? 0);
  // Market-data display only: never the user's spend.
  const num = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(n);

  // Refresh periodically so the synthetic book looks alive (display only, re-anchored
  // to the pair's real last price as it updates).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 3000);
    return () => clearInterval(id);
  }, []);
  const book = useMemo(
    () => makeOrderBook(mid, { pricePrecision: pair?.pricePrecision ?? 2, quantityPrecision: pair?.quantityPrecision ?? 6 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mid, tick, pair?.pricePrecision, pair?.quantityPrecision],
  );

  const body = () => {
    if (!mid) return <p className={styles.note}>{t('trading.selectPair')}</p>;
    const maxTotal = Math.max(1, ...book.asks.map((e) => e.total), ...book.bids.map((e) => e.total));
    const bestBid = book.bids[0]?.price;
    const bestAsk = book.asks[0]?.price;
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
          {/* Best ask nearest the spread (reversed). */}
          <tbody>{rows([...book.asks].slice(0, 12).reverse(), styles.askPrice, styles.askDepth)}</tbody>
        </table>
        {spread != null && (
          <div className={styles.spreadRow}>
            <span>{t('trading.book.spread')}</span>
            <strong>{num(spread)}</strong>
          </div>
        )}
        <table className={styles.bookTable}>
          <tbody>{rows(book.bids.slice(0, 12), styles.bidPrice, styles.bidDepth)}</tbody>
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
