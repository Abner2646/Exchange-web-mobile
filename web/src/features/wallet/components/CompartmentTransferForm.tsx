'use client';

import { useMemo, useState } from 'react';
import { parseInput, compare } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useCompartmentTransfer, useMyBalances } from '../queries';
import type { BalanceEntry, Compartment } from '../types';
import styles from './wallet.module.css';

export default function CompartmentTransferForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const transfer = useCompartmentTransfer();
  const { data } = useMyBalances();
  const balances: BalanceEntry[] = data ?? [];

  const [cryptoId, setCryptoId] = useState('');
  const [from, setFrom] = useState<Compartment>('funding');
  const [to, setTo] = useState<Compartment>('spot');
  const [amount, setAmount] = useState('');

  const parsed = useMemo(() => parseInput(amount, { locale }), [amount, locale]);
  const amountOk = parsed.ok && compare(parsed.value, '0') > 0;
  const sameCompartment = from === to;

  const sourceAvailable = useMemo(() => {
    const entry = balances.find((b) => b.criptomonedaId === cryptoId);
    if (!entry) return null;
    return from === 'funding'
      ? entry.compartments.funding.available
      : entry.compartments.spot.available;
  }, [balances, cryptoId, from]);

  const exceedsAvailable =
    amountOk && sourceAvailable != null && compare(parsed.value, sourceAvailable) > 0;

  // Require a KNOWN source-compartment balance: if it hasn't loaded, block submit
  // rather than let an amount-vs-unknown check silently pass (money guard).
  const canSubmit =
    Boolean(cryptoId) && amountOk && !sameCompartment && sourceAvailable != null && !exceedsAvailable && !transfer.isPending;

  const showError = (msg: string) => (
    <p role="alert" className={styles.label}>{msg}</p>
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !parsed.ok) return;
    try {
      await transfer.mutateAsync({ cryptoId, amount: parsed.value, from, to });
      setAmount('');
      onSuccess?.();
    } catch {
      // error surfaced via transfer.error below
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2>{t('wallet.transfer.title')}</h2>

      <Field label={t('wallet.balances.crypto')}>
        <select
          id="transfer-crypto"
          value={cryptoId}
          onChange={(e) => setCryptoId(e.target.value)}
        >
          <option value="">{t('wallet.deposit.selectCrypto')}</option>
          {balances.map((b) => (
            <option key={b.criptomonedaId} value={b.criptomonedaId}>
              {b.crypto?.symbol ?? b.criptomonedaId}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t('wallet.transfer.from')}>
        <select
          id="transfer-from"
          value={from}
          onChange={(e) => setFrom(e.target.value as Compartment)}
        >
          <option value="funding">{t('wallet.balances.funding')}</option>
          <option value="spot">{t('wallet.balances.spot')}</option>
        </select>
      </Field>

      <Field label={t('wallet.transfer.to')}>
        <select
          id="transfer-to"
          value={to}
          onChange={(e) => setTo(e.target.value as Compartment)}
        >
          <option value="funding">{t('wallet.balances.funding')}</option>
          <option value="spot">{t('wallet.balances.spot')}</option>
        </select>
      </Field>

      <Field label={t('wallet.transfer.amount')}>
        <input
          id="transfer-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoComplete="off"
        />
      </Field>

      {sameCompartment && showError(t('wallet.transfer.sameCompartment'))}
      {exceedsAvailable && showError(t('wallet.transfer.insufficient'))}
      {transfer.isError && transfer.error && showError(tError(transfer.error.code, { requestId: transfer.error.requestId ?? '' }))}
      {transfer.isSuccess && (
        <p role="status" className={styles.label}>{t('wallet.transfer.success')}</p>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={!canSubmit} loading={transfer.isPending}>
          {t('wallet.transfer.submit')}
        </Button>
      </div>
    </form>
  );
}
