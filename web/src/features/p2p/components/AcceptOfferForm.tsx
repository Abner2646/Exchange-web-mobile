'use client';

import { useMemo, useState } from 'react';
import { parseInput, compare, multiply, formatDisplay, gte, lte } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useMyBalances } from '@/features/wallet/queries';
import { useAcceptOffer } from '../queries';
import type { Offer, Transaction } from '../types';
import styles from './p2p.module.css';

export function AcceptOfferForm({
  offer,
  onDone,
}: {
  offer: Offer;
  onDone: (tx: Transaction) => void;
}) {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const { data: balances } = useMyBalances();
  const mutation = useAcceptOffer();

  const [rawAmount, setRawAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');

  // ---- Parse ----
  const parsed = useMemo(() => parseInput(rawAmount, { locale }), [rawAmount, locale]);
  const amountOk = parsed.ok && compare(parsed.value, '0') > 0;

  // ---- In-range gate (always) ----
  const inRange = amountOk && gte(parsed.value, offer.minAmount) && lte(parsed.value, offer.maxAmount);
  const outOfRange = amountOk && !inRange;

  // ---- Role ----
  // acceptor is BUYER when offer.type === 'sell', SELLER when offer.type === 'buy'
  const isSeller = offer.type === 'buy';

  // ---- Sufficiency gate — ONLY when acceptor is seller ----
  const fundingAvailable = useMemo(() => {
    if (!isSeller) return null; // not needed for buyer
    const entry = (balances ?? []).find((b) => b.criptomonedaId === offer.cryptoId);
    return entry?.compartments.funding.available ?? null;
  }, [balances, isSeller, offer.cryptoId]);

  // When isSeller and balances not yet loaded → fundingAvailable === null → block
  const balanceUnknown = isSeller && fundingAvailable === null;

  const requiredSpend = amountOk ? parsed.value : null;

  const insufficient =
    isSeller &&
    fundingAvailable !== null &&
    requiredSpend !== null &&
    compare(requiredSpend, fundingAvailable) > 0;

  // ---- Fiat disclosure (buyer only) ----
  const fiatOwed = useMemo(() => {
    if (!amountOk || isSeller) return null;
    return multiply(parsed.value, offer.unitPrice);
  }, [amountOk, isSeller, parsed, offer.unitPrice]);

  // ---- Submit disabled predicate (exact as specified) ----
  const canSubmit =
    inRange &&
    Boolean(paymentMethodId) &&
    !(isSeller && (balanceUnknown || (requiredSpend !== null && compare(requiredSpend, fundingAvailable!) > 0))) &&
    !mutation.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !parsed.ok) return;
    try {
      const tx = await mutation.mutateAsync({
        offerId: offer.id,
        amount: parsed.value,
        paymentMethodId,
      });
      onDone(tx);
    } catch {
      // error surfaced via mutation.isError / mutation.error below
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Amount input */}
      <Field
        label={t('p2p.accept.amountLabel', { crypto: offer.cryptoId })}
        helpText={t('p2p.accept.amountHint', {
          min: offer.minAmount,
          max: offer.maxAmount,
          crypto: offer.cryptoId,
        })}
      >
        <input
          id="accept-amount"
          inputMode="decimal"
          value={rawAmount}
          onChange={(e) => setRawAmount(e.target.value)}
          autoComplete="off"
        />
      </Field>

      {/* Out-of-range advisory */}
      {outOfRange && (
        <p role="alert" className={styles.error}>
          {t('p2p.accept.outOfRange', {
            min: offer.minAmount,
            max: offer.maxAmount,
            crypto: offer.cryptoId,
          })}
        </p>
      )}

      {/* Balance loading note — seller only, balances not yet available */}
      {isSeller && balanceUnknown && amountOk && (
        <p className={styles.label}>{t('p2p.accept.loadingBalance')}</p>
      )}

      {/* Insufficient balance advisory — seller only */}
      {insufficient && (
        <p role="alert" className={styles.error}>
          {t('p2p.accept.insufficientFunds')}
        </p>
      )}

      {/* Fiat disclosure — buyer only */}
      {!isSeller && fiatOwed !== null && (
        <div>
          <p>
            <span>{t('p2p.accept.fiatOwed')}</span>
            {' '}
            <span data-testid="fiat-owed">
              {formatDisplay(fiatOwed, { locale, maxDecimals: 2, stripTrailingZeros: true })}{' '}
              {offer.fiatCurrency}
            </span>
          </p>
          {offer.direccionFiat && (
            <p>
              <span className={styles.label}>{t('p2p.accept.sellerAddress')}: </span>
              <span>{offer.direccionFiat}</span>
            </p>
          )}
        </div>
      )}

      {/* Payment method select */}
      <Field label={t('p2p.accept.pickPaymentMethod')}>
        <select
          id="accept-payment-method"
          value={paymentMethodId}
          onChange={(e) => setPaymentMethodId(e.target.value)}
        >
          <option value="">{t('p2p.accept.pickPaymentMethod')}</option>
          {offer.paymentMethods.map((pm) => (
            <option key={pm.id} value={pm.id}>
              {pm.name}
            </option>
          ))}
        </select>
      </Field>

      {/* Mutation error */}
      {mutation.isError && mutation.error != null && (
        <p role="alert" className={styles.error}>
          {tError(
            (mutation.error as { code?: string }).code ?? 'FALLBACK_UNKNOWN_ERROR',
            { requestId: (mutation.error as { requestId?: string }).requestId ?? '' },
          )}
        </p>
      )}

      <Button type="submit" disabled={!canSubmit} loading={mutation.isPending}>
        {t('p2p.accept.submit')}
      </Button>
    </form>
  );
}
