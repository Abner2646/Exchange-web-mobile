'use client';

import { useTranslation } from '@/shared/i18n';
import { useOrderBook } from '../queries';
import type { OrderBookEntry } from '../types';
import styles from './trading.module.css';

export function OrderBookView({ tradingPairId }: { tradingPairId: string }) {
  const { t, locale } = useTranslation();
  const { data, isLoading, isError } = useOrderBook(tradingPairId, Boolean(tradingPairId));
  // Market-data display only: these are backend numbers, never the user's spend.
  const num = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 8 }).format(n);

  if (isLoading) return <p className={styles.label}>{t('common.loading')}</p>;
  if (isError || !data) return <p className={styles.label}>{t('trading.book.empty')}</p>;

  const bestBid = data.bids[0]?.price;
  const bestAsk = data.asks[0]?.price;
  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;

  const rows = (entries: OrderBookEntry[], cls: string) =>
    entries.map((e, i) => (
      <tr key={`${cls}-${i}`}>
        <td className={cls}>{num(e.price)}</td>
        <td>{num(e.quantity)}</td>
        <td>{num(e.total)}</td>
      </tr>
    ));

  return (
    <section>
      <h2>{t('trading.book.title')}</h2>
      {data.bids.length === 0 && data.asks.length === 0 ? (
        <p className={styles.label}>{t('trading.book.empty')}</p>
      ) : (
        <>
          <h3>{t('trading.book.asks')}</h3>
          <table className={styles.table}>
            <thead><tr><th>{t('trading.book.price')}</th><th>{t('trading.book.amount')}</th><th>{t('trading.book.total')}</th></tr></thead>
            <tbody>{rows(data.asks, styles.ask)}</tbody>
          </table>
          {spread != null && <p className={styles.spread}>{t('trading.book.spread')}: {num(spread)}</p>}
          <h3>{t('trading.book.bids')}</h3>
          <table className={styles.table}>
            <thead><tr><th>{t('trading.book.price')}</th><th>{t('trading.book.amount')}</th><th>{t('trading.book.total')}</th></tr></thead>
            <tbody>{rows(data.bids, styles.bid)}</tbody>
          </table>
        </>
      )}
    </section>
  );
}
