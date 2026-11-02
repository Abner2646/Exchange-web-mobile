'use client';

import { useMemo, useState } from 'react';
import { parseInput, compare, round, formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Input, Select, CoinLogo, useSuccessFlash } from '@/shared/ui';
import { useCompartmentTransfer, useMyBalances } from '../queries';
import type { BalanceEntry, Compartment } from '../types';
import styles from './wallet.module.css';

export default function CompartmentTransferForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const { flash } = useSuccessFlash();
  const transfer = useCompartmentTransfer();
  const { data } = useMyBalances();
  const balances: BalanceEntry[] = data ?? [];

  const [cryptoId, setCryptoId] = useState('');
  const [from, setFrom] = useState<Compartment>('funding');
  const [to, setTo] = useState<Compartment>('spot');
  const [amount, setAmount] = useState('');

  const fmt = (v: string) => formatDisplay(v, { locale, maxDecimals: 8, stripTrailingZeros: true });

  const entry = useMemo(() => balances.find((b) => b.criptomonedaId === cryptoId), [balances, cryptoId]);
  const symbol = entry?.crypto?.symbol ?? '';
  const decimals = Math.min(entry?.crypto?.decimals ?? 8, 8);

  const parsed = useMemo(() => parseInput(amount, { locale }), [amount, locale]);
  const amountOk = parsed.ok && compare(parsed.value, '0') > 0;
  const sameCompartment = from === to;

  const sourceAvailable = useMemo(() => {
    if (!entry) return null;
    return from === 'funding' ? entry.compartments.funding.available : entry.compartments.spot.available;
  }, [entry, from]);

  const exceedsAvailable = amountOk && sourceAvailable != null && compare(parsed.value, sourceAvailable) > 0;

  // Require a KNOWN source-compartment balance: if it hasn't loaded, block submit
  // rather than let an amount-vs-unknown check silently pass (money guard).
  const canSubmit =
    Boolean(cryptoId) && amountOk && !sameCompartment && sourceAvailable != null && !exceedsAvailable && !transfer.isPending;

  const cryptoOptions = balances.map((b) => {
    const sym = b.crypto?.symbol ?? b.criptomonedaId;
    const funding = b.compartments.funding.available;
    return {
      value: b.criptomonedaId,
      text: sym,
      icon: <CoinLogo symbol={sym} size={22} />,
      label: <strong>{sym}</strong>,
      meta: compare(funding, '0') > 0 ? fmt(funding) : undefined,
    };
  });

  const compartmentOptions = [
    { value: 'funding', label: t('wallet.balances.funding') },
    { value: 'spot', label: t('wallet.balances.spot') },
  ];

  const useMax = () => { if (sourceAvailable != null) setAmount(sourceAvailable); };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !parsed.ok) return;
    // Round to the asset's precision (capped at 8) before sending — the ledger works
    // in canonical string-math and we never want to push more precision than it keeps.
    const canonical = round(parsed.value, decimals);
    const toLabel = t(`wallet.balances.${to}`);
    try {
      await transfer.mutateAsync({ cryptoId, amount: canonical, from, to });
      flash({
        title: t('wallet.transfer.flashTitle'),
        detail: t('wallet.transfer.flashDetail', { amount: `${fmt(canonical)} ${symbol}`, to: toLabel }),
      });
      setAmount('');
      onSuccess?.();
    } catch {
      // error surfaced via transfer.error below
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.formTitle}>{t('wallet.transfer.title')}</h2>

      <Field label={t('wallet.balances.crypto')}>
        <Select
          options={cryptoOptions}
          value={cryptoId || null}
          onChange={setCryptoId}
          aria-label={t('wallet.balances.crypto')}
          placeholder={t('wallet.deposit.selectCrypto')}
          searchable
          searchPlaceholder={t('wallet.balances.crypto')}
        />
      </Field>

      <Field label={t('wallet.transfer.from')}>
        <Select
          options={compartmentOptions}
          value={from}
          onChange={(v) => setFrom(v as Compartment)}
          aria-label={t('wallet.transfer.from')}
        />
      </Field>

      <Field label={t('wallet.transfer.to')}>
        <Select
          options={compartmentOptions}
          value={to}
          onChange={(v) => setTo(v as Compartment)}
          aria-label={t('wallet.transfer.to')}
        />
      </Field>

      <div className={styles.fieldBlock}>
        <div className={styles.fieldHead}>
          <label htmlFor="transfer-amount" className={styles.amountLabel}>{t('wallet.transfer.amount')}</label>
          {sourceAvailable != null && (
            <button type="button" className={styles.maxBtn} onClick={useMax}>
              {t('wallet.form.max')} <strong>{fmt(sourceAvailable)}</strong> {symbol}
            </button>
          )}
        </div>
        <Input
          id="transfer-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoComplete="off"
          placeholder="0"
        />
      </div>

      {sameCompartment && <p role="alert" className={styles.alert}>{t('wallet.transfer.sameCompartment')}</p>}
      {exceedsAvailable && <p role="alert" className={styles.alert}>{t('wallet.transfer.insufficient')}</p>}
      {transfer.isError && transfer.error && (
        <p role="alert" className={styles.alert}>{tError(transfer.error.code, { requestId: transfer.error.requestId ?? '' })}</p>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={!canSubmit} loading={transfer.isPending}>
          {t('wallet.transfer.submit')}
        </Button>
      </div>
    </form>
  );
}
