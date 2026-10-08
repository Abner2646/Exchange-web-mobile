'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useMyBalances, useDepositAddress } from '../queries';
import type { BalanceEntry } from '../types';
import styles from './wallet.module.css';

export default function DepositView() {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const { data } = useMyBalances();
  const balances: BalanceEntry[] = data ?? [];

  const [cryptoId, setCryptoId] = useState('');
  const [copied, setCopied] = useState(false);
  const deposit = useDepositAddress(cryptoId, Boolean(cryptoId));

  async function copy(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <div className={styles.form}>
      <h2>{t('wallet.deposit.title')}</h2>

      <Field label={t('wallet.balances.crypto')}>
        <select
          id="deposit-crypto"
          value={cryptoId}
          onChange={(e) => { setCryptoId(e.target.value); setCopied(false); }}
        >
          <option value="">{t('wallet.deposit.selectCrypto')}</option>
          {balances.map((b) => (
            <option key={b.criptomonedaId} value={b.criptomonedaId}>
              {b.crypto?.symbol ?? b.criptomonedaId}
            </option>
          ))}
        </select>
      </Field>

      {deposit.isLoading && <p>{t('common.loading')}</p>}
      {deposit.isError && deposit.error && (
        <p role="alert">{tError(deposit.error.code)}</p>
      )}

      {deposit.data && (
        <div className={styles.row}>
          <span className={styles.label}>{t('wallet.deposit.address')}</span>
          <span className={styles.code}>{deposit.data.address}</span>
          <span className={styles.label}>
            {t('wallet.deposit.network')}: {deposit.data.metadata.network}
          </span>
          <span className={styles.label}>
            {t('wallet.deposit.confirmations')}: {deposit.data.metadata.confirmationsRequired}
          </span>
          <div className={styles.actions}>
            <Button type="button" onClick={() => copy(deposit.data!.address)}>
              {copied ? t('wallet.deposit.copied') : t('wallet.deposit.copy')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
