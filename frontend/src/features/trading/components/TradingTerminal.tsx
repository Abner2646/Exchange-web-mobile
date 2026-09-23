import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createChart, IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { useTranslation } from '../../../shared/i18n/useTranslation';
import { useErrorTranslation } from '../../../shared/i18n/errorCatalog';
import { formatDisplay, add } from '../../../shared/money';
import { useTradingPairs, useOrderBook, useChartData } from '../queries';
import { ApiError } from '../../../shared/api/errors';
import styles from './TradingTerminal.module.css';

export function TradingTerminal() {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);

  const {
    data: pairs,
    isLoading: isLoadingPairs,
    error: pairsError
  } = useTradingPairs();

  const {
    data: orderBook,
    isLoading: isLoadingOrderBook,
    error: orderBookError
  } = useOrderBook(selectedPairId);

  const {
    data: chartData,
    isLoading: isLoadingChart,
    error: chartError
  } = useChartData(selectedPairId, '1h');

  // Select first pair by default
  useEffect(() => {
    if (pairs && pairs.length > 0 && !selectedPairId) {
      setSelectedPairId(pairs[0].tradingPairId);
    }
  }, [pairs, selectedPairId]);

  const filteredPairs = useMemo(() => {
    if (!pairs) return [];
    if (!searchQuery) return pairs;
    const lowerQ = searchQuery.toLowerCase();
    return pairs.filter(p => p.symbol.toLowerCase().includes(lowerQ));
  }, [pairs, searchQuery]);

  // Chart setup
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f3fa' },
        horzLines: { color: '#f0f3fa' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && chartData && chartData.length > 0) {
      // lightweight-charts needs data sorted by time
      const sorted = [...chartData].sort((a, b) => {
        const timeA = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time;
        const timeB = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
        return (timeA as number) - (timeB as number);
      });
      
      // NOTE (money rule exception): lightweight-charts plots on a canvas and REQUIRES
      // JS numbers for OHLC coordinates. This Number() conversion is for VISUAL rendering
      // only — it is never used for money math or for displaying an exact amount. All
      // authoritative price/amount display (order book, labels) uses money.formatDisplay
      // on the canonical strings. Do not reuse these numbers for anything but the chart.
      const formatted = sorted.map(d => ({
        time: (typeof d.time === 'string' ? new Date(d.time).getTime() / 1000 : d.time) as UTCTimestamp,
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
      }));

      seriesRef.current.setData(formatted);
      if (chartRef.current) {
         chartRef.current.timeScale().fitContent();
      }
    } else if (seriesRef.current) {
      seriesRef.current.setData([]);
    }
  }, [chartData]);

  const renderError = (err: Error) => {
    const code = err instanceof ApiError ? err.code : 'UNKNOWN_ERROR';
    return <div className={styles.error}>{tError(code)}</div>;
  };

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder={t('search_pairs') || 'Search pairs...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        {isLoadingPairs && <div className={styles.loading}>{t('loading') || 'Loading...'}</div>}
        {pairsError && renderError(pairsError as Error)}
        {!isLoadingPairs && !pairsError && (
          <ul className={styles.pairList}>
            {filteredPairs.map(pair => (
              <li
                key={pair.tradingPairId}
                className={`${styles.pairItem} ${selectedPairId === pair.tradingPairId ? styles.active : ''}`}
                onClick={() => setSelectedPairId(pair.tradingPairId)}
              >
                <div className={styles.pairSymbol}>{pair.symbol}</div>
                <div className={styles.pairPrice}>
                  {formatDisplay(String(pair.lastPrice), { locale, maxDecimals: 4 })}
                </div>
                <div className={`${styles.pairChange} ${pair.priceChange24h >= 0 ? styles.positive : styles.negative}`}>
                  {pair.priceChange24h >= 0 ? '+' : ''}{pair.priceChange24h.toFixed(2)}%
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <main className={styles.main}>
        <div className={styles.chartSection}>
          <h2 className={styles.sectionTitle}>{t('chart') || 'Price Chart'}</h2>
          {isLoadingChart && <div className={styles.loading}>{t('loading') || 'Loading chart...'}</div>}
          {chartError && renderError(chartError as Error)}
          <div 
            ref={chartContainerRef} 
            className={styles.chartContainer} 
            style={{ display: isLoadingChart || chartError ? 'none' : 'block' }}
          />
        </div>

        <div className={styles.orderBookSection}>
          <h2 className={styles.sectionTitle}>{t('order_book') || 'Order Book'}</h2>
          {isLoadingOrderBook && <div className={styles.loading}>{t('loading') || 'Loading order book...'}</div>}
          {orderBookError && renderError(orderBookError as Error)}
          
          {!isLoadingOrderBook && !orderBookError && orderBook && (
            <div className={styles.orderBookContainer}>
              <div className={styles.obHeader}>
                <span>{t('price') || 'Price'}</span>
                <span>{t('amount') || 'Amount'}</span>
                <span>{t('total') || 'Total'}</span>
              </div>
              <div className={styles.asks}>
                {orderBook.asks.slice().reverse().map((ask, i, arr) => {
                  // Cumulative sum is just visual, simplistic approx here or calculate exact
                  let cumulative = '0';
                  for (let j = arr.length - 1; j >= i; j--) {
                    cumulative = add(cumulative, arr[j].quantity);
                  }
                  return (
                    <div key={`ask-${i}`} className={`${styles.obRow} ${styles.askRow}`}>
                      <span className={styles.askPrice}>{formatDisplay(ask.price, { locale, maxDecimals: 4 })}</span>
                      <span>{formatDisplay(ask.quantity, { locale, maxDecimals: 4 })}</span>
                      <span>{formatDisplay(cumulative, { locale, maxDecimals: 4 })}</span>
                    </div>
                  );
                })}
              </div>
              <div className={styles.obDivider}></div>
              <div className={styles.bids}>
                {orderBook.bids.map((bid, i, arr) => {
                  let cumulative = '0';
                  for (let j = 0; j <= i; j++) {
                    cumulative = add(cumulative, arr[j].quantity);
                  }
                  return (
                    <div key={`bid-${i}`} className={`${styles.obRow} ${styles.bidRow}`}>
                      <span className={styles.bidPrice}>{formatDisplay(bid.price, { locale, maxDecimals: 4 })}</span>
                      <span>{formatDisplay(bid.quantity, { locale, maxDecimals: 4 })}</span>
                      <span>{formatDisplay(cumulative, { locale, maxDecimals: 4 })}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
