'use client';

import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button } from '@/shared/ui';
import type { ApiError } from '@/shared/api';
import type { QuoteResponse, SwapType } from '../types';
import styles from './swap.module.css';

interface Props {
  quote?: QuoteResponse;
  error?: ApiError | null;
  isFetching: boolean;
  type: SwapType;
  baseAmount: string; // canonical entered amount (money-safe source of truth for base display)
  baseSymbol: string;
  quoteSymbol: string;
  onRetry: () => void;
}

export function QuoteDisplay({ quote, error, isFetching, type, baseAmount, baseSymbol, quoteSymbol, onRetry }: Props) {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();

  const fmt = (v: string) => formatDisplay(v, { locale, maxDecimals: 8, stripTrailingZeros: true });

  if (error?.code === 'PRICE_ORACLE_DIVERGENCE') {
    return (
      <div className={`${styles.quote} ${styles.paused}`} role="alert">
        <p>{tError('PRICE_ORACLE_DIVERGENCE')}</p>
        <Button type="button" variant="secondary" onClick={onRetry}>{t('swap.form.pausedRetry')}</Button>
      </div>
    );
  }
  if (isFetching) return <p className={styles.label}>{t('swap.quote.loading')}</p>;
  if (error) return <p role="alert" className={styles.label}>{tError(error.code, { requestId: error.requestId ?? '' })}</p>;
  if (!quote) return <p className={styles.label}>{t('swap.quote.empty')}</p>;

  const c = quote.calculo;
  // Use the canonical entered amount for the base display — NEVER String(c.baseAmount)
  // (backend echo may be a JS number; String(1e-8) would break formatDisplay).
  const base = baseAmount;
  // buy: pay finalAmount (quote), receive base; sell: pay base, receive finalAmount (quote)
  const youPay = type === 'buy' ? `${fmt(c.finalAmount)} ${quoteSymbol}` : `${fmt(base)} ${baseSymbol}`;
  const youReceive = type === 'buy' ? `${fmt(base)} ${baseSymbol}` : `${fmt(c.finalAmount)} ${quoteSymbol}`;

  return (
    <div className={styles.quote}>
      <h2>{t('swap.quote.title')}</h2>
      <div className={styles.row}><span>{t('swap.quote.youPay')}</span><strong>{youPay}</strong></div>
      <div className={styles.row}><span>{t('swap.quote.youReceive')}</span><strong>{youReceive}</strong></div>
      <div className={styles.row}><span>{t('swap.quote.fee')}</span><span>{fmt(c.feeAmount)} {quoteSymbol}</span></div>
      <div className={styles.row}><span>{t('swap.quote.price')}</span><span>{fmt(c.precioEfectivo)} {quoteSymbol}</span></div>
      <p className={styles.label}>{t('swap.quote.indicative')}</p>
    </div>
  );
}
