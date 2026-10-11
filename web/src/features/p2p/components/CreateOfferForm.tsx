'use client';

import { useMemo, useState } from 'react';
import { parseInput, compare, gt } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useCreateOffer, useCryptoCatalog, usePaymentMethods } from '../queries';
import type { Offer, OfferType } from '../types';
import styles from './p2p.module.css';

export function CreateOfferForm({ onCreated }: { onCreated: (offer: Offer) => void }) {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const { data: cryptos } = useCryptoCatalog();
  const { data: methods } = usePaymentMethods();
  const mutation = useCreateOffer();

  const [type, setType] = useState<OfferType>('buy');
  const [cryptoId, setCryptoId] = useState('');
  const [rawMin, setRawMin] = useState('');
  const [rawMax, setRawMax] = useState('');
  const [rawPrice, setRawPrice] = useState('');
  const [fiatCurrency, setFiatCurrency] = useState('');
  const [metodosPagoIds, setMetodosPagoIds] = useState<string[]>([]);
  const [additionalTerms, setAdditionalTerms] = useState('');
  const [direccionFiat, setDireccionFiat] = useState('');

  // ---- Parse money fields ----
  const parsedMin = useMemo(() => parseInput(rawMin, { locale }), [rawMin, locale]);
  const parsedMax = useMemo(() => parseInput(rawMax, { locale }), [rawMax, locale]);
  const parsedPrice = useMemo(() => parseInput(rawPrice, { locale }), [rawPrice, locale]);

  const minOk = parsedMin.ok && gt(parsedMin.value, '0');
  const maxOk = parsedMax.ok && gt(parsedMax.value, '0');
  const priceOk = parsedPrice.ok && gt(parsedPrice.value, '0');

  // min must not exceed max (advisory only — both must parse first)
  const minGtMax = minOk && maxOk && compare(parsedMin.value, parsedMax.value) > 0;

  // ---- Other field gates ----
  const fiatOk = fiatCurrency.trim().length === 3;
  const methodsOk = metodosPagoIds.length >= 1;
  const direccionFiatOk = type === 'buy' || direccionFiat.trim().length > 0;

  // ---- Submit disabled predicate ----
  const canSubmit =
    Boolean(cryptoId) &&
    minOk &&
    maxOk &&
    priceOk &&
    !minGtMax &&
    fiatOk &&
    methodsOk &&
    direccionFiatOk &&
    !mutation.isPending;

  // ---- Handlers ----
  function handleMethodsChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
    setMetodosPagoIds(selected);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !parsedMin.ok || !parsedMax.ok || !parsedPrice.ok) return;
    try {
      const offer = await mutation.mutateAsync({
        type,
        cryptoId,
        minAmount: parsedMin.value,
        maxAmount: parsedMax.value,
        unitPrice: parsedPrice.value,
        fiatCurrency: fiatCurrency.trim().toUpperCase(),
        ...(additionalTerms.trim() ? { additionalTerms: additionalTerms.trim() } : {}),
        metodosPagoIds,
        ...(type === 'sell' ? { direccionFiat: direccionFiat.trim() } : {}),
      });
      onCreated(offer);
    } catch {
      // error surfaced via mutation.isError / mutation.error below
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Offer type */}
      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 0.75rem' }}>
        <legend style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #666)', marginBottom: '0.25rem' }}>
          {/* No i18n label needed — the radio labels speak for themselves */}
        </legend>
        <label style={{ marginRight: '1rem' }}>
          <input
            type="radio"
            name="offer-type"
            value="buy"
            checked={type === 'buy'}
            onChange={() => setType('buy')}
          />
          {' '}{t('p2p.create.typeBuy')}
        </label>
        <label>
          <input
            type="radio"
            name="offer-type"
            value="sell"
            checked={type === 'sell'}
            onChange={() => setType('sell')}
          />
          {' '}{t('p2p.create.typeSell')}
        </label>
      </fieldset>

      {/* Crypto select */}
      <Field label={t('p2p.create.crypto')}>
        <select
          id="create-offer-crypto"
          value={cryptoId}
          onChange={(e) => setCryptoId(e.target.value)}
        >
          <option value=""></option>
          {(cryptos ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.symbol} — {c.name}
            </option>
          ))}
        </select>
      </Field>

      {/* Min amount */}
      <Field label={t('p2p.create.min')}>
        <input
          id="create-offer-min"
          inputMode="decimal"
          value={rawMin}
          onChange={(e) => setRawMin(e.target.value)}
          autoComplete="off"
        />
      </Field>

      {/* Max amount */}
      <Field label={t('p2p.create.max')}>
        <input
          id="create-offer-max"
          inputMode="decimal"
          value={rawMax}
          onChange={(e) => setRawMax(e.target.value)}
          autoComplete="off"
        />
      </Field>

      {/* Min > max advisory */}
      {minGtMax && (
        <p role="alert" className={styles.error}>
          {t('p2p.create.minGtMax')}
        </p>
      )}

      {/* Unit price */}
      <Field label={t('p2p.create.unitPrice')}>
        <input
          id="create-offer-price"
          inputMode="decimal"
          value={rawPrice}
          onChange={(e) => setRawPrice(e.target.value)}
          autoComplete="off"
        />
      </Field>

      {/* Fiat currency */}
      <Field label={t('p2p.create.fiatCurrency')}>
        <input
          id="create-offer-fiat"
          value={fiatCurrency}
          onChange={(e) => setFiatCurrency(e.target.value)}
          maxLength={3}
          autoComplete="off"
        />
      </Field>

      {/* Payment methods multi-select */}
      <Field label={t('p2p.create.paymentMethods')}>
        <select
          id="create-offer-methods"
          multiple
          value={metodosPagoIds}
          onChange={handleMethodsChange}
          size={Math.min((methods ?? []).filter((m) => m.active).length || 3, 5)}
        >
          {(methods ?? [])
            .filter((m) => m.active)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
      </Field>

      {/* Direccion fiat — required and shown ONLY for sell */}
      {type === 'sell' && (
        <Field
          label={t('p2p.create.direccionFiat')}
          helpText={t('p2p.create.direccionFiatHelp')}
        >
          <input
            id="create-offer-direccion"
            value={direccionFiat}
            onChange={(e) => setDireccionFiat(e.target.value)}
            autoComplete="off"
          />
        </Field>
      )}

      {/* Additional terms (optional) */}
      <Field label={t('p2p.create.terms')}>
        <textarea
          id="create-offer-terms"
          value={additionalTerms}
          onChange={(e) => setAdditionalTerms(e.target.value)}
          rows={3}
        />
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
        {t('p2p.create.submit')}
      </Button>
    </form>
  );
}
