'use client';

import { useMemo, useState } from 'react';
import { parseInput, compare } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Select } from '@/shared/ui';
import { useMyBalances } from '@/features/wallet/queries';
import { PairSelect } from './PairSelect';
import { QuoteDisplay } from './QuoteDisplay';
import { usePairs, useSwapQuote, useCheckLimit, useExecuteSwap } from '../queries';
import type { SwapType, SwapCompartment } from '../types';
import styles from './swap.module.css';

export default function SwapForm() {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const { data: pairs } = usePairs();
  const { data: balances } = useMyBalances();
  const execute = useExecuteSwap();

  const [pairId, setPairId] = useState('');
  const [type, setType] = useState<SwapType>('buy');
  const [compartment, setCompartment] = useState<SwapCompartment>('funding');
  const [amount, setAmount] = useState('');

  const pair = useMemo(() => (pairs ?? []).find((p) => p.id === pairId), [pairs, pairId]);
  const parsed = useMemo(() => parseInput(amount, { locale }), [amount, locale]);
  const amountOk = parsed.ok && compare(parsed.value, '0') > 0;

  const quoteEnabled = Boolean(pairId) && amountOk && !!pair && !pair.oraclePaused;
  const quoteReq = { pairId, baseAmount: parsed.ok ? parsed.value : '0', type };
  const quote = useSwapQuote(quoteReq, quoteEnabled);

  // Exact sufficiency gate.
  // buy  → user spends quote asset (USDT), amount = quote.calculo.finalAmount
  // sell → user spends base asset (BTC),  amount = parsed.value (entered amount)
  const needAsset = pair ? (type === 'buy' ? pair.quoteCryptoId : pair.baseCryptoId) : null;
  const needSymbol = pair ? (type === 'buy' ? pair.quoteSymbol : pair.baseSymbol) : '';
  const availableInCompartment = useMemo(() => {
    if (!needAsset) return null;
    const entry = (balances ?? []).find((b) => b.criptomonedaId === needAsset);
    if (!entry) return null;
    return entry.compartments[compartment]?.available ?? null;
  }, [balances, needAsset, compartment]);

  const requiredSpend =
    type === 'buy' ? (quote.data?.calculo.finalAmount ?? null) : parsed.ok ? parsed.value : null;

  const insufficient =
    availableInCompartment != null && requiredSpend != null
      ? compare(requiredSpend, availableInCompartment) > 0
      : false;

  const checkLimit = useCheckLimit(quote.data?.calculo.quoteAmount ?? '0', Boolean(quote.data) && amountOk);
  const limitExceeded = checkLimit.isError && (checkLimit.error as { code?: string } | null)?.code === 'EXCHANGE_DAILY_LIMIT_EXCEEDED';

  const canSubmit =
    Boolean(pairId) &&
    amountOk &&
    !!pair &&
    !pair.oraclePaused &&
    !!quote.data &&
    quote.error == null &&
    availableInCompartment != null &&
    !insufficient &&
    !execute.isPending;

  // Max fills the BASE amount from the available balance of the asset being spent.
  // sell → spend base directly; buy → convert the available quote at the pair price.
  // Display convenience only; the authoritative gates above still re-check.
  const maxBase = useMemo(() => {
    if (!pair || availableInCompartment == null) return null;
    if (type === 'sell') return availableInCompartment;
    const price = Number(pair.currentPrice);
    const avail = Number(availableInCompartment);
    if (!price || !Number.isFinite(price) || !Number.isFinite(avail)) return null;
    return (avail / price).toFixed(8).replace(/\.?0+$/, '');
  }, [pair, availableInCompartment, type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !parsed.ok) return;
    try {
      await execute.mutateAsync({ pairId, type, baseAmount: parsed.value, compartimento: compartment });
      setAmount('');
    } catch {
      // error surfaced via execute.isError / execute.error below
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <PairSelect value={pairId} onChange={setPairId} />

      <div className={styles.directionToggle} role="group" aria-label={t('swap.form.type')}>
        <button
          type="button"
          className={`${styles.directionBtn} ${type === 'buy' ? styles.directionActive : ''}`}
          aria-pressed={type === 'buy'}
          onClick={() => setType('buy')}
        >
          {t('swap.form.buy')}
        </button>
        <button
          type="button"
          className={`${styles.directionBtn} ${type === 'sell' ? styles.directionActive : ''}`}
          aria-pressed={type === 'sell'}
          onClick={() => setType('sell')}
        >
          {t('swap.form.sell')}
        </button>
      </div>

      <Field label={t('swap.form.compartment')}>
        <Select
          value={compartment}
          onChange={(v) => setCompartment(v as SwapCompartment)}
          aria-label={t('swap.form.compartment')}
          options={[
            { value: 'funding', label: t('wallet.balances.funding') },
            { value: 'spot', label: t('wallet.balances.spot') },
          ]}
        />
      </Field>

      <div>
        <div className={styles.fieldHead}>
          <label htmlFor="swap-amount" className={styles.fieldLabel}>{t('swap.form.amount')}</label>
          {pair && availableInCompartment != null && (
            <span className={styles.balanceText}>
              {t('swap.form.balance')} <strong>{availableInCompartment}</strong> {needSymbol}
            </span>
          )}
        </div>
        <div className={styles.amountRow}>
          <input
            id="swap-amount"
            className={styles.amountInput}
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className={styles.maxBtn}
            disabled={maxBase == null}
            onClick={() => maxBase != null && setAmount(maxBase)}
          >
            {t('swap.form.max')}
          </button>
        </div>
      </div>

      {pair?.oraclePaused ? (
        <p role="alert" className={styles.paused}>{t('swap.form.paused')}</p>
      ) : (
        pair && (
          <QuoteDisplay
            quote={quote.data}
            error={quote.error}
            isFetching={quote.isFetching}
            type={type}
            baseAmount={parsed.ok ? parsed.value : '0'}
            baseSymbol={pair.baseSymbol}
            quoteSymbol={pair.quoteSymbol}
            onRetry={() => quote.refetch()}
          />
        )
      )}

      {insufficient && <p role="alert" className={styles.label}>{t('swap.form.insufficient')}</p>}
      {limitExceeded && <p role="alert" className={styles.label}>{t('swap.form.limitExceeded')}</p>}
      {checkLimit.data?.canTransact && !limitExceeded && (
        <p className={styles.label}>{t('swap.form.limitRemaining', { remaining: String(checkLimit.data.remainingLimit) })}</p>
      )}
      {execute.isError && execute.error && (
        <p role="alert" className={styles.label}>
          {tError((execute.error as { code?: string }).code ?? 'FALLBACK_UNKNOWN_ERROR', {
            requestId: (execute.error as { requestId?: string }).requestId ?? '',
          })}
        </p>
      )}
      {execute.isSuccess && execute.data && (
        <div role="status" className={styles.success}>
          <p>{t('swap.success.title')}</p>
          <p>{t('swap.success.priceUsed', { price: execute.data.data.precioUsado })}</p>
          <p>{t('swap.success.fee', { fee: execute.data.data.comisionCalculada })}</p>
        </div>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={!canSubmit} loading={execute.isPending}>
          {t('swap.form.submit')}
        </Button>
      </div>
    </form>
  );
}
