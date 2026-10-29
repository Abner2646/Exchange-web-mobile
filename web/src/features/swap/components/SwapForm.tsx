'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseInput, compare, multiply, divide, formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Select, CoinLogo, useSuccessFlash } from '@/shared/ui';
import { ArrowDownIcon } from '@/shared/ui/icons/Icon';
import { useMyBalances } from '@/features/wallet/queries';
import { usePairs, useSwapQuote, useCheckLimit, useExecuteSwap } from '../queries';
import type { SwapType, SwapCompartment } from '../types';
import styles from './swap.module.css';

type Coin = { id: string; symbol: string };

function CoinSelect({
  value,
  onChange,
  coins,
  label,
  balanceOf,
  fmt,
}: {
  value: string;
  onChange: (id: string) => void;
  coins: Coin[];
  label: string;
  balanceOf: (id: string) => string;
  fmt: (v: string) => string;
}) {
  const options = coins.map((c) => {
    const bal = balanceOf(c.id);
    return {
      value: c.id,
      text: c.symbol,
      icon: <CoinLogo symbol={c.symbol} size={22} />,
      label: <strong>{c.symbol}</strong>,
      meta: compare(bal, '0') > 0 ? fmt(bal) : undefined,
    };
  });
  return <Select options={options} value={value || null} onChange={onChange} aria-label={label} placeholder="—" searchable searchPlaceholder={label} />;
}

export default function SwapForm() {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const { flash } = useSuccessFlash();
  const { data: pairs } = usePairs();
  const { data: balances } = useMyBalances();
  const execute = useExecuteSwap();

  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [driver, setDriver] = useState<'from' | 'to'>('from');
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [compartment, setCompartment] = useState<SwapCompartment>('funding');
  const [spin, setSpin] = useState(0); // drives the ⇅ flip animation

  const fmt = (v: string) => formatDisplay(v, { locale, maxDecimals: 8, stripTrailingZeros: true });

  // Available (total, display) balance per coin — used to rank + annotate the pickers.
  const balanceOf = useCallback(
    (id: string) => (balances ?? []).find((b) => b.criptomonedaId === id)?.availableBalance ?? '0',
    [balances],
  );
  // Coins with a balance first (by balance, desc); zero-balance coins after, alphabetical.
  const orderByBalance = useCallback(
    (list: Coin[]) =>
      [...list].sort((a, b) => {
        const ba = balanceOf(a.id);
        const bb = balanceOf(b.id);
        const pa = compare(ba, '0') > 0;
        const pb = compare(bb, '0') > 0;
        if (pa && pb) return compare(bb, ba);
        if (pa !== pb) return pa ? -1 : 1;
        return a.symbol.localeCompare(b.symbol);
      }),
    [balanceOf],
  );

  // All coins that appear in any pair, and (given From) the coins it can pair with.
  const coins = useMemo(() => {
    const m = new Map<string, Coin>();
    (pairs ?? []).forEach((p) => {
      m.set(p.baseCryptoId, { id: p.baseCryptoId, symbol: p.baseSymbol });
      m.set(p.quoteCryptoId, { id: p.quoteCryptoId, symbol: p.quoteSymbol });
    });
    return Array.from(m.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [pairs]);

  const toCoins = useMemo(() => {
    if (!fromId) return coins;
    const ok = new Set<string>();
    (pairs ?? []).forEach((p) => {
      if (p.baseCryptoId === fromId) ok.add(p.quoteCryptoId);
      if (p.quoteCryptoId === fromId) ok.add(p.baseCryptoId);
    });
    return coins.filter((c) => ok.has(c.id));
  }, [coins, pairs, fromId]);

  const fromCoins = useMemo(() => orderByBalance(coins), [coins, orderByBalance]);
  const toCoinsOrdered = useMemo(() => orderByBalance(toCoins), [toCoins, orderByBalance]);

  // Default to paying with USDT (a familiar stablecoin) rather than whatever the
  // catalog happens to list first (e.g. BTC/PEPE → PEPE). Falls back to pair 0.
  useEffect(() => {
    if (fromId || !pairs || pairs.length === 0) return;
    const preferred = pairs.find((p) => p.quoteSymbol === 'USDT') ?? pairs[0];
    setFromId(preferred.quoteCryptoId);
    setToId(preferred.baseCryptoId);
  }, [pairs, fromId]);

  // Map the (from, to) coins to a backend pair + direction.
  const found = useMemo(() => {
    const p = (pairs ?? []).find(
      (x) => (x.baseCryptoId === fromId && x.quoteCryptoId === toId) || (x.baseCryptoId === toId && x.quoteCryptoId === fromId),
    );
    if (!p) return null;
    const type: SwapType = p.baseCryptoId === fromId ? 'sell' : 'buy';
    return { pair: p, type };
  }, [pairs, fromId, toId]);
  const pair = found?.pair;
  const type = found?.type ?? 'buy';
  const price = pair?.currentPrice ?? null;
  const fromSymbol = coins.find((c) => c.id === fromId)?.symbol ?? '';
  const toSymbol = coins.find((c) => c.id === toId)?.symbol ?? '';
  // The quote asset (price + fee are denominated in it) is the quote side of the pair.
  const quoteSym = type === 'sell' ? toSymbol : fromSymbol;

  // The field being driven resolves a canonical BASE amount for the quote. When the
  // driven field is the quote asset, convert with the pair price (money-safe divide).
  const drivenText = driver === 'from' ? fromText : toText;
  const parsedDriven = useMemo(() => parseInput(drivenText, { locale }), [drivenText, locale]);
  const drivenIsBase = (type === 'sell' && driver === 'from') || (type === 'buy' && driver === 'to');
  const baseAmount = useMemo(() => {
    if (!pair || !parsedDriven.ok) return null;
    if (drivenIsBase) return parsedDriven.value;
    if (!price || compare(price, '0') <= 0) return null;
    try { return divide(parsedDriven.value, price); } catch { return null; }
  }, [pair, parsedDriven, drivenIsBase, price]);
  const baseOk = baseAmount != null && compare(baseAmount, '0') > 0;

  const quoteEnabled = !!pair && !pair.oraclePaused && baseOk;
  const quote = useSwapQuote({ pairId: pair?.id ?? '', baseAmount: baseAmount ?? '0', type }, quoteEnabled);

  // Side amounts: base is authoritative from the entry; the quote side comes from the
  // backend quote (fee-accurate) or a price estimate before it arrives.
  const baseSide = baseAmount;
  const quoteSide = quote.data?.calculo.finalAmount ?? (baseAmount && price ? (() => { try { return multiply(baseAmount, price); } catch { return null; } })() : null);
  const fromVal = type === 'sell' ? baseSide : quoteSide;
  const toVal = type === 'sell' ? quoteSide : baseSide;
  const fromDisplay = driver === 'from' ? fromText : fromVal != null ? fmt(fromVal) : '';
  const toDisplay = driver === 'to' ? toText : toVal != null ? fmt(toVal) : '';

  // Sufficiency gate — the spent asset is always the From coin.
  const availableFrom = useMemo(() => {
    const entry = (balances ?? []).find((b) => b.criptomonedaId === fromId);
    return entry?.compartments[compartment]?.available ?? null;
  }, [balances, fromId, compartment]);
  const requiredSpend = fromVal;
  const insufficient = availableFrom != null && requiredSpend != null ? compare(requiredSpend, availableFrom) > 0 : false;

  const checkLimit = useCheckLimit(quote.data?.calculo.quoteAmount ?? '0', Boolean(quote.data) && baseOk);
  const limitExceeded = checkLimit.isError && (checkLimit.error as { code?: string } | null)?.code === 'EXCHANGE_DAILY_LIMIT_EXCEEDED';

  const canSubmit =
    !!pair &&
    !pair.oraclePaused &&
    baseOk &&
    !!quote.data &&
    quote.error == null &&
    availableFrom != null &&
    !insufficient &&
    !execute.isPending;

  const setFrom = (v: string) => { setDriver('from'); setFromText(v); };
  const setTo = (v: string) => { setDriver('to'); setToText(v); };
  const useMax = () => { if (availableFrom != null) setFrom(availableFrom); };
  const swapSides = () => {
    setFromId(toId); setToId(fromId);
    setFromText(toText); setToText(fromText);
    setDriver((d) => (d === 'from' ? 'to' : 'from'));
    setSpin((s) => s + 1);
  };
  // Alternating class so the fade animation restarts on every flip (same keyframes).
  const flipClass = spin === 0 ? '' : spin % 2 ? styles.flipA : styles.flipB;
  const chooseFrom = (id: string) => { setFromId(id); if (id === toId) setToId(''); };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || baseAmount == null || !pair) return;
    const paid = fromVal != null ? `${fmt(fromVal)} ${fromSymbol}` : '';
    const received = toVal != null ? `${fmt(toVal)} ${toSymbol}` : '';
    try {
      await execute.mutateAsync({ pairId: pair.id, type, baseAmount, compartimento: compartment });
      flash({ title: t('swap.success.flashTitle'), detail: t('swap.success.flashDetail', { paid, received }) });
      setFromText(''); setToText('');
    } catch { /* surfaced in the receipt below */ }
  }

  return (
    <form className={styles.twoPanel} onSubmit={handleSubmit} noValidate>
      {/* LEFT — De / A */}
      <div className={styles.formCard}>
        <div className={[styles.coinField, flipClass].filter(Boolean).join(' ')}>
          <div className={styles.fieldHead}>
            <span className={styles.fieldLabel}>{t('swap.form.from')}</span>
            {availableFrom != null && (
              <button type="button" className={styles.balanceBtn} onClick={useMax}>
                {t('swap.form.balance')} <strong>{fmt(availableFrom)}</strong> {fromSymbol}
              </button>
            )}
          </div>
          <div className={styles.coinRow}>
            <CoinSelect value={fromId} onChange={chooseFrom} coins={fromCoins} label={t('swap.form.from')} balanceOf={balanceOf} fmt={fmt} />
            <input
              className={styles.amountInput}
              inputMode="decimal"
              placeholder="0"
              aria-label={t('swap.form.fromAmount')}
              value={fromDisplay}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.swapRow}>
          <button
            type="button"
            className={styles.swapBtn}
            style={{ transform: `rotate(${spin * 180}deg)` }}
            onClick={swapSides}
            aria-label={t('swap.form.flip')}
          >
            <ArrowDownIcon size={18} />
          </button>
        </div>

        <div className={[styles.coinField, flipClass].filter(Boolean).join(' ')}>
          <span className={styles.fieldLabel}>{t('swap.form.to')}</span>
          <div className={styles.coinRow}>
            <CoinSelect value={toId} onChange={setToId} coins={toCoinsOrdered} label={t('swap.form.to')} balanceOf={balanceOf} fmt={fmt} />
            <input
              className={styles.amountInput}
              inputMode="decimal"
              placeholder="0"
              aria-label={t('swap.form.toAmount')}
              value={toDisplay}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
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
      </div>

      {/* RIGHT — live receipt → result */}
      <aside className={styles.receipt}>
        {execute.isSuccess && execute.data ? (
          <div className={styles.receiptDone} role="status">
            <div className={styles.doneCheck} aria-hidden="true">✓</div>
            <p className={styles.doneTitle}>{t('swap.success.title')}</p>
            <p className={styles.doneLine}>{t('swap.success.priceUsed', { price: execute.data.data.precioUsado })}</p>
            <p className={styles.doneLine}>{t('swap.success.fee', { fee: execute.data.data.comisionCalculada })}</p>
          </div>
        ) : (
          <>
            <h2 className={styles.receiptTitle}>{t('swap.quote.title')}</h2>
            {!pair ? (
              <p className={styles.label}>{t('swap.quote.selectCoins')}</p>
            ) : pair.oraclePaused ? (
              <p role="alert" className={styles.paused}>{t('swap.form.paused')}</p>
            ) : (
              // Never empty: the rate + fee structure shows even at 0, with a live
              // price preview; the quote refines the numbers once an amount is entered.
              <>
                <div className={styles.receiveBig}>
                  <span className={styles.receiveLabel}>{t('swap.quote.youReceive')}</span>
                  <span className={[styles.receiveAmount, toVal == null ? styles.muted : ''].filter(Boolean).join(' ')}>
                    {toVal != null ? fmt(toVal) : '0'} {toSymbol}
                  </span>
                </div>
                <div className={styles.row}><span>{t('swap.quote.youPay')}</span><strong>{fromVal != null ? fmt(fromVal) : '0'} {fromSymbol}</strong></div>
                <div className={styles.row}><span>{t('swap.quote.rate')}</span><span>1 {pair.baseSymbol} = {price ? fmt(price) : '—'} {pair.quoteSymbol}</span></div>
                <div className={styles.row}><span>{t('swap.quote.fee')}</span><span>{quote.data ? `${fmt(quote.data.calculo.feeAmount)} ${quoteSym}` : `${pair.feePercent}%`}</span></div>
                {quote.isFetching ? (
                  <p className={styles.label}>{t('swap.quote.loading')}</p>
                ) : quote.error ? (
                  <p role="alert" className={styles.alert}>{tError(quote.error.code, { requestId: quote.error.requestId ?? '' })}</p>
                ) : baseOk ? (
                  <p className={styles.label}>{t('swap.quote.indicative')}</p>
                ) : (
                  <p className={styles.label}>{t('swap.quote.empty')}</p>
                )}
              </>
            )}

            {insufficient && <p role="alert" className={styles.alert}>{t('swap.form.insufficient')}</p>}
            {limitExceeded && <p role="alert" className={styles.alert}>{t('swap.form.limitExceeded')}</p>}
            {checkLimit.data?.canTransact && !limitExceeded && (
              <p className={styles.label}>{t('swap.form.limitRemaining', { remaining: String(checkLimit.data.remainingLimit) })}</p>
            )}
            {execute.isError && execute.error && (
              <p role="alert" className={styles.alert}>
                {tError((execute.error as { code?: string }).code ?? 'FALLBACK_UNKNOWN_ERROR', { requestId: (execute.error as { requestId?: string }).requestId ?? '' })}
              </p>
            )}

            <div className={styles.actions}>
              <Button type="submit" disabled={!canSubmit} loading={execute.isPending}>{t('swap.form.submit')}</Button>
            </div>
          </>
        )}
      </aside>
    </form>
  );
}
