'use client';

import { useMemo, useState } from 'react';
import { parseInput, compare } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useWithdraw, useMyBalances } from '../queries';
import type { BalanceEntry } from '../types';
import styles from './wallet.module.css';

export default function WithdrawForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const withdraw = useWithdraw();
  const { data } = useMyBalances();
  const balances: BalanceEntry[] = data ?? [];

  const [cryptoId, setCryptoId] = useState('');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');

  const parsed = useMemo(() => parseInput(amount, { locale }), [amount, locale]);
  const amountOk = parsed.ok && compare(parsed.value, '0') > 0;
  const addressOk = address.trim().length > 0;

  // Withdrawals are Funding-only: read ONLY funding.available for the sufficiency check.
  const fundingAvailable = useMemo(() => {
    const entry = balances.find((b) => b.criptomonedaId === cryptoId);
    return entry ? entry.compartments.funding.available : null;
  }, [balances, cryptoId]);

  const exceeds =
    amountOk && fundingAvailable != null && compare(parsed.value, fundingAvailable) > 0;

  // Require a KNOWN Funding balance: if the balance entry hasn't loaded, block
  // submit rather than let an amount-vs-unknown check silently pass (money guard).
  const canSubmit =
    Boolean(cryptoId) && amountOk && addressOk && fundingAvailable != null && !exceeds && !withdraw.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !parsed.ok) return;
    try {
      await withdraw.mutateAsync({
        cryptoId,
        amount: parsed.value,
        destinationAddress: address.trim(),
      });
      setAmount('');
      setAddress('');
      onSuccess?.();
    } catch {
      // error surfaced via withdraw.error below
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2>{t('wallet.withdraw.title')}</h2>
      <p className={styles.label}>{t('wallet.withdraw.fundingOnly')}</p>

      <Field label={t('wallet.withdraw.crypto')}>
        <select
          id="wd-crypto"
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

      <Field label={t('wallet.withdraw.amount')}>
        <input
          id="wd-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoComplete="off"
        />
      </Field>

      <Field label={t('wallet.withdraw.address')}>
        <input
          id="wd-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          autoComplete="off"
        />
      </Field>

      {exceeds && (
        <p role="alert" className={styles.label}>{t('wallet.transfer.insufficient')}</p>
      )}
      {withdraw.isError && withdraw.error && (
        <p role="alert" className={styles.label}>{tError(withdraw.error.code, { requestId: withdraw.error.requestId ?? '' })}</p>
      )}
      {withdraw.isSuccess && (
        <p role="status" className={styles.label}>{t('wallet.withdraw.queued')}</p>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={!canSubmit} loading={withdraw.isPending}>
          {t('wallet.withdraw.submit')}
        </Button>
      </div>
    </form>
  );
}
