'use client';

import { useMemo, useState } from 'react';
import { parseInput, compare } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
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
  const availableInCompartment = useMemo(() => {
    if (!needAsset) return null;
    const entry = (balances ?? []).find((b) => b.criptomonedaId === needAsset);
    if (!entry) return null;
    return entry.compartments[compartment]?.available ?? null;
  }, [balances, needAsset, compartment]);

  const requiredSpend =
    type === 'buy' ? (quote.data?.calculo.finalAmount ?? null) : parsed.ok ? parsed.value : null;

  // insufficient = true only when both sides are known and the balance is short.
  // If availableInCompartment is null (balance not loaded), we treat it as
  // unknown → cannot submit (no pass-on-unknown; WithdrawForm lesson).
  const insufficient =
    availableInCompartment != null && requiredSpend != null
      ? compare(requiredSpend, availableInCompartment) > 0
      : false;

  // Advisory daily-limit check; NOT the gate (execute is authoritative).
  const checkLimit = useCheckLimit(quote.data?.calculo.quoteAmount ?? '0', Boolean(quote.data));
  const limitExceeded = checkLimit.isError && (checkLimit.error as { code?: string } | null)?.code === 'EXCHANGE_DAILY_LIMIT_EXCEEDED';

  // canSubmit: all gates must pass.
  // - pair selected and not oracle-paused
  // - amount is valid and positive
  // - quote loaded and no quote error
  // - sufficiency: balance must be loaded (availableInCompartment != null) AND sufficient
  // - execute is not already pending (no double-submit)
  const canSubmit =
    Boolean(pairId) &&
    amountOk &&
    !!pair &&
    !pair.oraclePaused &&
    !!quote.data &&
    quote.error == null &&
    availableInCompartment != null &&   // block if balance not loaded
    !insufficient &&
    !execute.isPending;

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
      <h2>{t('swap.form.title')}</h2>

      <PairSelect value={pairId} onChange={setPairId} />

      <Field label={t('swap.form.type')}>
        <select
          id="swap-type"
          value={type}
          onChange={(e) => setType(e.target.value as SwapType)}
        >
          <option value="buy">{t('swap.form.buy')}</option>
          <option value="sell">{t('swap.form.sell')}</option>
        </select>
      </Field>

      <Field label={t('swap.form.compartment')}>
        <select
          id="swap-compartment"
          value={compartment}
          onChange={(e) => setCompartment(e.target.value as SwapCompartment)}
        >
          <option value="funding">{t('wallet.balances.funding')}</option>
          <option value="spot">{t('wallet.balances.spot')}</option>
        </select>
      </Field>

      <Field label={t('swap.form.amount')}>
        <input
          id="swap-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoComplete="off"
        />
      </Field>

      {pair && (
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
      )}

      {insufficient && (
        <p role="alert" className={styles.label}>
          {t('swap.form.insufficient')}
        </p>
      )}
      {limitExceeded && (
        <p role="alert" className={styles.label}>
          {t('swap.form.limitExceeded')}
        </p>
      )}
      {execute.isError && execute.error && (
        <p role="alert" className={styles.label}>
          {tError((execute.error as { code?: string }).code ?? 'FALLBACK_UNKNOWN_ERROR', {
            requestId: (execute.error as { requestId?: string }).requestId ?? '',
          })}
        </p>
      )}
      {execute.isSuccess && execute.data && (
        <div role="status" className={styles.label}>
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
