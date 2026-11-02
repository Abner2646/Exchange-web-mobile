'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { formatDisplay, compare } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
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
  loading: () => <div className={styles.panel} style={{ minHeight: 380 }} />,
});

export default function TradingWidget() {
  const { t, locale } = useTranslation();
  const { data: pairs } = usePairs();
  // Single source of truth: one pair drives the ticker, book, trades AND the form.
  const [pairId, setPairId] = useState('');
  const pair = useMemo(() => (pairs ?? []).find((p) => p.id === pairId), [pairs, pairId]);

  const change = pair?.priceChange24h;
  const changeTone = change == null ? styles.flat : compare(change, '0') > 0 ? styles.up : compare(change, '0') < 0 ? styles.down : styles.flat;
  const changeStr = change == null ? '—' : `${compare(change, '0') > 0 ? '+' : ''}${formatDisplay(change, { locale, maxDecimals: 2 })}%`;

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('trading.title')}</h1>
        <p className={styles.subtitle}>{t('trading.subtitle')}</p>
      </header>

      <div className={styles.ticker}>
        <div className={styles.pairPicker}>
          <TradingPairSelect value={pairId} onChange={setPairId} />
        </div>
        {pair && (
          <>
            <div className={styles.tickerStat}>
              <span className={styles.tickerLabel}>{t('trading.ticker.last')}</span>
              <span className={styles.tickerValue}>{pair.lastPrice ? formatDisplay(pair.lastPrice, { locale, maxDecimals: 8, stripTrailingZeros: true }) : '—'} {pair.quoteSymbol}</span>
            </div>
            <div className={styles.tickerStat}>
              <span className={styles.tickerLabel}>{t('trading.ticker.change')}</span>
              <span className={`${styles.tickerValue} ${changeTone}`}>{changeStr}</span>
            </div>
            {pair.volume24h != null && (
              <div className={styles.tickerStat}>
                <span className={styles.tickerLabel}>{t('trading.ticker.volume')}</span>
                <span className={styles.tickerValue}>{formatDisplay(pair.volume24h, { locale, maxDecimals: 2 })} {pair.quoteSymbol}</span>
              </div>
            )}
          </>
        )}
      </div>

      {pairId && <div style={{ marginBottom: 'var(--spacing-lg)' }}><PriceChart pairId={pairId} /></div>}

      <div className={styles.terminal}>
        <div className={styles.leftCol}>
          <OrderBookView tradingPairId={pairId} />
          <RecentTradesView tradingPairId={pairId} />
        </div>
        <OrderForm pairId={pairId} />
      </div>

      <div className={styles.myOrders}>
        <MyOrdersView />
      </div>
    </section>
  );
}
