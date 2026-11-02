'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { TradingPairSelect } from './TradingPairSelect';
import { OrderBookView } from './OrderBookView';
import { RecentTradesView } from './RecentTradesView';
import OrderForm from './OrderForm';
import MyOrdersView from './MyOrdersView';
import { usePairs } from '../queries';
import styles from './trading.module.css';

// lightweight-charts touches the DOM — load the chart client-side only (no SSR).
const PriceChart = dynamic(() => import('./PriceChart'), {
  ssr: false,
  loading: () => <div className={`${styles.panel} ${styles.chartPanel}`} style={{ minHeight: 560 }} />,
});

export default function TradingWidget() {
  const { data: pairs } = usePairs();
  // Single source of truth: one pair drives the chart, ticker, book, trades AND the form.
  const [pairId, setPairId] = useState('');
  const pair = useMemo(() => (pairs ?? []).find((p) => p.id === pairId), [pairs, pairId]);

  // Pro terminals always show a market — default to BTC/USDT (or the first pair).
  useEffect(() => {
    if (pairId || !pairs || pairs.length === 0) return;
    const preferred = pairs.find((p) => p.symbol === 'BTC/USDT') ?? pairs[0];
    setPairId(preferred.id);
  }, [pairs, pairId]);

  return (
    <section className={styles.page}>
      <div className={styles.terminal}>
        <div className={styles.bookCol}>
          <OrderBookView pair={pair} />
          <RecentTradesView pair={pair} />
        </div>
        <div className={styles.chartCol}>
          <PriceChart
            pairId={pairId}
            pair={pair}
            pairSelector={<TradingPairSelect value={pairId} onChange={setPairId} />}
          />
        </div>
        <div className={styles.formCol}>
          <OrderForm pairId={pairId} />
        </div>
      </div>

      <div className={styles.myOrders}>
        <MyOrdersView />
      </div>
    </section>
  );
}
