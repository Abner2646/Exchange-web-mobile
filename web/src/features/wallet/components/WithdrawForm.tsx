'use client';

import { useMemo, useState } from 'react';
import { parseInput, compare, round, formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Input, Select, CoinLogo, useSuccessFlash, InfoIcon, ClockIcon } from '@/shared/ui';
import { useWithdraw, useMyBalances } from '../queries';
import type { BalanceEntry } from '../types';
import styles from './wallet.module.css';

export default function WithdrawForm({ onSuccess }: { onSuccess?: () => void }) {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const { flash } = useSuccessFlash();
  const withdraw = useWithdraw();
  const { data } = useMyBalances();
  const balances: BalanceEntry[] = data ?? [];

  const [cryptoId, setCryptoId] = useState('');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');

  const fmt = (v: string) => formatDisplay(v, { locale, maxDecimals: 8, stripTrailingZeros: true });

  const entry = useMemo(() => balances.find((b) => b.criptomonedaId === cryptoId), [balances, cryptoId]);
  const symbol = entry?.crypto?.symbol ?? '';

  const parsed = useMemo(() => parseInput(amount, { locale }), [amount, locale]);
  const amountOk = parsed.ok && compare(parsed.value, '0') > 0;
  const addressOk = address.trim().length > 0;

  // Withdrawals are Funding-only: read ONLY funding.available for the sufficiency check.
  const fundingAvailable = useMemo(() => (entry ? entry.compartments.funding.available : null), [entry]);
  const exceeds = amountOk && fundingAvailable != null && compare(parsed.value, fundingAvailable) > 0;

  // Require a KNOWN Funding balance: if the balance entry hasn't loaded, block
  // submit rather than let an amount-vs-unknown check silently pass (money guard).
  const canSubmit =
    Boolean(cryptoId) && amountOk && addressOk && fundingAvailable != null && !exceeds && !withdraw.isPending;

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

  const useMax = () => { if (fundingAvailable != null) setAmount(fundingAvailable); };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !parsed.ok) return;
    // Backend Joi caps withdrawal amounts at 8 decimals (precision(8)); round before sending.
    const canonical = round(parsed.value, 8);
    try {
      await withdraw.mutateAsync({ cryptoId, amount: canonical, destinationAddress: address.trim() });
      flash({
        title: t('wallet.withdraw.flashTitle'),
        detail: t('wallet.withdraw.flashDetail', { amount: `${fmt(canonical)} ${symbol}` }),
      });
      setAmount('');
      setAddress('');
      onSuccess?.();
    } catch {
      // error surfaced via withdraw.error below
    }
  }

  return (
    <div className={styles.withdrawAside}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <h2 className={styles.formTitle}>{t('wallet.withdraw.title')}</h2>

        <Field label={t('wallet.withdraw.crypto')}>
          <Select
            options={cryptoOptions}
            value={cryptoId || null}
            onChange={setCryptoId}
            aria-label={t('wallet.withdraw.crypto')}
            placeholder={t('wallet.deposit.selectCrypto')}
            searchable
            searchPlaceholder={t('wallet.withdraw.crypto')}
          />
        </Field>

        <div className={styles.fieldBlock}>
          <div className={styles.fieldHead}>
            <label htmlFor="wd-amount" className={styles.amountLabel}>{t('wallet.withdraw.amount')}</label>
            {fundingAvailable != null && (
              <button type="button" className={styles.maxBtn} onClick={useMax}>
                {t('wallet.form.max')} <strong>{fmt(fundingAvailable)}</strong> {symbol}
              </button>
            )}
          </div>
          <Input
            id="wd-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoComplete="off"
            placeholder="0"
          />
        </div>

        <Field label={t('wallet.withdraw.address')}>
          <Input
            id="wd-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            autoComplete="off"
            placeholder={t('wallet.withdraw.addressPlaceholder')}
          />
        </Field>

        {exceeds && <p role="alert" className={styles.alert}>{t('wallet.transfer.insufficient')}</p>}
        {withdraw.isError && withdraw.error && (
          <p role="alert" className={styles.alert}>{tError(withdraw.error.code, { requestId: withdraw.error.requestId ?? '' })}</p>
        )}

        <div className={styles.actions}>
          <Button type="submit" disabled={!canSubmit} loading={withdraw.isPending}>
            {t('wallet.withdraw.submit')}
          </Button>
        </div>
      </form>

      <aside className={styles.infoPanel}>
        <h3 className={styles.infoPanelTitle}>{t('wallet.withdraw.infoTitle')}</h3>
        <p className={styles.infoRow}><InfoIcon size={16} /><span>{t('wallet.withdraw.fundingOnly')}</span></p>
        <p className={styles.infoRow}><ClockIcon size={16} /><span>{t('wallet.withdraw.reviewNote')}</span></p>
      </aside>
    </div>
  );
}
