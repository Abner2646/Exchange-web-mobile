'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart, IChartApi, ISeriesApi, UTCTimestamp, ColorType, CrosshairMode,
} from 'lightweight-charts';
import React from 'react';
import { formatDisplay, compare } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { useChartData } from '../queries';
import type { Candle, ChartInterval, TradingPair } from '../types';
import styles from './trading.module.css';

const INTERVALS: ChartInterval[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
type ChartType = 'candlestick' | 'line' | 'area';
const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: 'candlestick', label: 'Velas' },
  { value: 'line', label: 'Línea' },
  { value: 'area', label: 'Área' },
];
type IndKey = 'ma7' | 'ma25' | 'ma99' | 'ema7' | 'ema25' | 'bollinger';
const IND_META: { key: IndKey; label: string; color: string }[] = [
  { key: 'ma7', label: 'MA7', color: '#FFB800' },
  { key: 'ma25', label: 'MA25', color: '#FF6838' },
  { key: 'ma99', label: 'MA99', color: '#2962FF' },
  { key: 'ema7', label: 'EMA7', color: '#00E396' },
  { key: 'ema25', label: 'EMA25', color: '#775DD0' },
  { key: 'bollinger', label: 'BB', color: '#2196F3' },
];

type Linepoint = { time: UTCTimestamp; value: number };
const sma = (d: Candle[], p: number): Linepoint[] => {
  const out: Linepoint[] = [];
  for (let i = p - 1; i < d.length; i++) {
    let s = 0;
    for (let j = 0; j < p; j++) s += d[i - j].close;
    out.push({ time: d[i].time as UTCTimestamp, value: s / p });
  }
  return out;
};
const ema = (d: Candle[], p: number): Linepoint[] => {
  if (d.length < p) return [];
  const out: Linepoint[] = [];
  const k = 2 / (p + 1);
  let e = d.slice(0, p).reduce((s, c) => s + c.close, 0) / p;
  out.push({ time: d[p - 1].time as UTCTimestamp, value: e });
  for (let i = p; i < d.length; i++) { e = (d[i].close - e) * k + e; out.push({ time: d[i].time as UTCTimestamp, value: e }); }
  return out;
};
const bollinger = (d: Candle[], p = 20, mult = 2) => {
  const mid = sma(d, p);
  const upper: Linepoint[] = [], lower: Linepoint[] = [];
  for (let i = 0; i < mid.length; i++) {
    const di = i + p - 1;
    let sq = 0;
    for (let j = 0; j < p; j++) sq += Math.pow(d[di - j].close - mid[i].value, 2);
    const sd = Math.sqrt(sq / p);
    upper.push({ time: mid[i].time, value: mid[i].value + mult * sd });
    lower.push({ time: mid[i].time, value: mid[i].value - mult * sd });
  }
  return { mid, upper, lower };
};

function palette(dark: boolean) {
  return {
    bg: dark ? '#1E2329' : '#FFFFFF',
    text: dark ? '#B7BDC6' : '#3A4454',
    grid: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    border: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
    up: dark ? '#10B981' : '#059669',
    down: dark ? '#EF4444' : '#DC2626',
    line: dark ? '#3B82F6' : '#2563EB',
  };
}

export default function PriceChart({ pairId, pair, pairSelector }: { pairId: string; pair?: TradingPair; pairSelector?: React.ReactNode }) {
  const { t, locale } = useTranslation();
  const { theme } = useTheme();
  const [interval, setIntervalState] = useState<ChartInterval>('1h');
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [indicators, setIndicators] = useState<Record<IndKey, boolean>>({ ma7: false, ma25: false, ma99: false, ema7: false, ema25: false, bollinger: false });
  const [showVolume, setShowVolume] = useState(true);

  const { data, isLoading, isError } = useChartData(pairId, interval, Boolean(pairId));
  const candles = useMemo(() => {
    const rows = [...(data ?? [])].sort((a, b) => a.time - b.time);
    // lightweight-charts rejects duplicate timestamps — keep the last candle per time.
    const seen = new Map<number, Candle>();
    rows.forEach((c) => seen.set(c.time, c));
    return Array.from(seen.values());
  }, [data]);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const indRef = useRef<ISeriesApi<'Line'>[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || candles.length === 0) return;
    const pal = palette(theme === 'dark');

    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight || 480,
      layout: { background: { type: ColorType.Solid, color: pal.bg }, textColor: pal.text },
      grid: { vertLines: { color: pal.grid }, horzLines: { color: pal.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: pal.border, scaleMargins: { top: 0.1, bottom: showVolume ? 0.2 : 0.1 } },
      timeScale: { borderColor: pal.border, timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    if (chartType === 'candlestick') {
      const s = chart.addCandlestickSeries({ upColor: pal.up, downColor: pal.down, borderUpColor: pal.up, borderDownColor: pal.down, wickUpColor: pal.up, wickDownColor: pal.down });
      s.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
    } else if (chartType === 'line') {
      const s = chart.addLineSeries({ color: pal.line, lineWidth: 2 });
      s.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
    } else {
      const s = chart.addAreaSeries({ lineColor: pal.line, topColor: 'rgba(59,130,246,0.4)', bottomColor: 'rgba(59,130,246,0.0)', lineWidth: 2 });
      s.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
    }

    if (showVolume) {
      const vol = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' });
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      vol.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)' })));
    }

    // Overlay indicators (only those the V1 actually renders).
    indRef.current = [];
    const addLine = (pts: Linepoint[], color: string, style: 0 | 2 = 0) => {
      if (pts.length === 0) return;
      const s = chart.addLineSeries({ color, lineWidth: 1, lineStyle: style, priceLineVisible: false, lastValueVisible: false });
      s.setData(pts);
      indRef.current.push(s);
    };
    if (candles.length >= 100) {
      if (indicators.ma7) addLine(sma(candles, 7), '#FFB800');
      if (indicators.ma25) addLine(sma(candles, 25), '#FF6838');
      if (indicators.ma99) addLine(sma(candles, 99), '#2962FF');
      if (indicators.ema7) addLine(ema(candles, 7), '#00E396', 2);
      if (indicators.ema25) addLine(ema(candles, 25), '#775DD0', 2);
      if (indicators.bollinger) {
        const { mid, upper, lower } = bollinger(candles, 20, 2);
        addLine(upper, 'rgba(33,150,243,0.5)');
        addLine(mid, 'rgba(33,150,243,0.8)', 2);
        addLine(lower, 'rgba(33,150,243,0.5)');
      }
    }

    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => { if (chartRef.current && el.clientWidth > 0) chartRef.current.applyOptions({ width: el.clientWidth, height: el.clientHeight || 480 }); });
    ro.observe(el);
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; indRef.current = []; };
  }, [candles, chartType, showVolume, indicators, theme]);

  const toggleInd = (k: IndKey) => setIndicators((p) => ({ ...p, [k]: !p[k] }));

  // 24h change tone + string (market display only).
  const change = pair?.priceChange24h;
  const changeTone = change == null ? styles.flat : compare(change, '0') > 0 ? styles.up : compare(change, '0') < 0 ? styles.down : styles.flat;
  const changeStr = change == null ? '—' : `${compare(change, '0') > 0 ? '+' : ''}${formatDisplay(change, { locale, maxDecimals: 2 })}%`;

  return (
    <section className={`${styles.panel} ${styles.chartPanel}`}>
      {/* Top bar: instrument (pair + ticker) on the left, chart controls on the right. */}
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
        <div className={styles.chartControls}>
          <div className={styles.intervalPills} role="group" aria-label={t('trading.chart.interval')}>
            {INTERVALS.map((iv) => (
              <button key={iv} type="button" aria-pressed={interval === iv} className={`${styles.pill} ${interval === iv ? styles.pillActive : ''}`} onClick={() => setIntervalState(iv)}>{iv}</button>
            ))}
          </div>
          <div className={styles.intervalPills} role="group" aria-label={t('trading.chart.type')}>
            {CHART_TYPES.map((ct) => (
              <button key={ct.value} type="button" aria-pressed={chartType === ct.value} className={`${styles.pill} ${chartType === ct.value ? styles.pillActive : ''}`} onClick={() => setChartType(ct.value)}>{ct.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.indChips} role="group" aria-label={t('trading.chart.indicators')}>
        {IND_META.map((ind) => (
          <button key={ind.key} type="button" aria-pressed={indicators[ind.key]} className={`${styles.chip} ${indicators[ind.key] ? styles.chipOn : ''}`} onClick={() => toggleInd(ind.key)}>
            <span className={styles.chipDot} style={{ backgroundColor: ind.color }} />{ind.label}
          </button>
        ))}
        <button type="button" aria-pressed={showVolume} className={`${styles.chip} ${showVolume ? styles.chipOn : ''}`} onClick={() => setShowVolume((v) => !v)}>{t('trading.chart.volume')}</button>
      </div>

      <div className={styles.chartWrap}>
        <div ref={containerRef} className={styles.chartCanvas} />
        {isLoading && <div className={styles.chartOverlay}>{t('common.loading')}</div>}
        {isError && <div className={`${styles.chartOverlay} ${styles.alert}`} role="alert">{t('trading.chart.error')}</div>}
        {!isLoading && !isError && candles.length === 0 && <div className={styles.chartOverlay}>{t('trading.chart.empty')}</div>}
      </div>
    </section>
  );
}
