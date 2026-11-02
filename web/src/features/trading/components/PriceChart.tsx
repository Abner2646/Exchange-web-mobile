'use client';

import React, { useEffect, useId, useRef } from 'react';
import { formatDisplay, compare } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import type { TradingPair } from '../types';
import styles from './trading.module.css';

// Official TradingView Advanced Chart widget (tv.js) — full drawing-tools toolbar,
// indicators, timeframes with TradingView's own iconography. It renders its own
// iframe and uses TradingView's market data; we drive its symbol from our pair
// selector. Our order book / ticker / order form live around it.
declare global {
  interface Window { TradingView?: { widget: new (config: Record<string, unknown>) => unknown } }
}

let tvScript: Promise<void> | null = null;
function loadTradingView(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.TradingView) return Promise.resolve();
  if (!tvScript) {
    tvScript = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://s3.tradingview.com/tv.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('tv.js failed to load'));
      document.head.appendChild(s);
    });
  }
  return tvScript;
}

// Our "BTC/USDT" → a TradingView symbol. Binance is the most liquid feed TV carries.
const tvSymbolFor = (pair?: TradingPair) => (pair ? `BINANCE:${pair.baseSymbol}${pair.quoteSymbol}` : null);

// Colours matching the page (--bg-primary + subtle grid/scales) so the widget blends
// in instead of showing TradingView's default gray pane.
function tvColors(dark: boolean) {
  return dark
    ? { bg: '#0A0E13', grid: 'rgba(255,255,255,0.04)', text: '#848E9C', line: 'rgba(43,49,57,0.6)' }
    : { bg: '#F7F8FA', grid: 'rgba(0,0,0,0.05)', text: '#5B6676', line: '#DCE0E7' };
}

export default function PriceChart({ pairId, pair, pairSelector }: { pairId: string; pair?: TradingPair; pairSelector?: React.ReactNode }) {
  const { t, locale } = useTranslation();
  const { theme } = useTheme();
  const rawId = useId();
  const containerId = `tv-chart-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const containerRef = useRef<HTMLDivElement>(null);

  const symbol = tvSymbolFor(pair);

  useEffect(() => {
    if (!symbol || !containerRef.current) return;
    let cancelled = false;
    loadTradingView()
      .then(() => {
        if (cancelled || !containerRef.current || !window.TradingView) return;
        containerRef.current.innerHTML = '';
        const c = tvColors(theme === 'dark');
        new window.TradingView.widget({
          container_id: containerId,
          autosize: true,
          symbol,
          interval: '60',
          timezone: 'Etc/UTC',
          theme: theme === 'dark' ? 'dark' : 'light',
          style: '1', // candles
          locale: locale === 'es' ? 'es' : 'en',
          hide_side_toolbar: false, // drawing tools
          hide_top_toolbar: false, // timeframes + indicators
          allow_symbol_change: false, // we drive the symbol from our pair selector
          withdateranges: true,
          details: false,
          calendar: false,
          // Blend with the page background instead of TradingView's default pane colour.
          backgroundColor: c.bg,
          gridColor: c.grid,
          toolbar_bg: c.bg,
          overrides: {
            'paneProperties.background': c.bg,
            'paneProperties.backgroundType': 'solid',
            'paneProperties.vertGridProperties.color': c.grid,
            'paneProperties.horzGridProperties.color': c.grid,
            'scalesProperties.textColor': c.text,
            'scalesProperties.lineColor': c.line,
            'scalesProperties.backgroundColor': c.bg,
          },
        });
      })
      .catch(() => { /* network/script failure — placeholder stays */ });
    return () => { cancelled = true; };
  }, [symbol, theme, locale, containerId]);

  // 24h change tone + string (market display only).
  const change = pair?.priceChange24h;
  const changeTone = change == null ? styles.flat : compare(change, '0') > 0 ? styles.up : compare(change, '0') < 0 ? styles.down : styles.flat;
  const changeStr = change == null ? '—' : `${compare(change, '0') > 0 ? '+' : ''}${formatDisplay(change, { locale, maxDecimals: 2 })}%`;

  return (
    <section className={`${styles.panel} ${styles.chartPanel}`}>
      {/* Top bar: our pair selector + ticker (drives the whole terminal). */}
      <div className={styles.chartTopBar}>
        <div className={styles.chartInstrument}>
          {pairSelector && <div className={styles.chartPairPicker}>{pairSelector}</div>}
          {pair && (
            <div className={styles.chartStats}>
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
            </div>
          )}
        </div>
      </div>

      <div className={styles.chartWrap}>
        <div ref={containerRef} id={containerId} className={styles.chartCanvas} />
        {!pairId && <div className={styles.chartOverlay}>{t('trading.selectPair')}</div>}
      </div>
    </section>
  );
}
