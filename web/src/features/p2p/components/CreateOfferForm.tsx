'use client';

import { useMemo, useState } from 'react';
import { parseInput, compare, gt, round } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Input, Select, Textarea, useSuccessFlash } from '@/shared/ui';
import { useCreateOffer, useCryptoCatalog, usePaymentMethods } from '../queries';
import type { Offer, OfferType } from '../types';
import styles from './p2p.module.css';

export function CreateOfferForm({ onCreated }: { onCreated: (offer: Offer) => void }) {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const { flash } = useSuccessFlash();
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

  const activeMethods = (methods ?? []).filter((m) => m.active);
  const cryptoOptions = (cryptos ?? []).map((c) => ({
    value: c.id,
    label: `${c.symbol} — ${c.name}`,
    text: `${c.symbol} ${c.name}`,
  }));

  function toggleMethod(id: string) {
    setMetodosPagoIds((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !parsedMin.ok || !parsedMax.ok || !parsedPrice.ok) return;
    try {
      // Round to the precision the backend keeps: amounts DECIMAL(18,8), price DECIMAL(10,4).
      const offer = await mutation.mutateAsync({
        type,
        cryptoId,
        minAmount: round(parsedMin.value, 8),
        maxAmount: round(parsedMax.value, 8),
        unitPrice: round(parsedPrice.value, 4),
        fiatCurrency: fiatCurrency.trim().toUpperCase(),
        ...(additionalTerms.trim() ? { additionalTerms: additionalTerms.trim() } : {}),
        metodosPagoIds,
        ...(type === 'sell' ? { direccionFiat: direccionFiat.trim() } : {}),
      });
      flash({ title: t('p2p.create.flashTitle'), detail: t('p2p.create.flashDetail') });
      onCreated(offer);
    } catch {
      // error surfaced via mutation.isError / mutation.error below
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* Offer type — segmented radio group with an accessible group name (fixes empty legend) */}
      <fieldset className={styles.fieldBlock} style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend className={styles.fieldLabel}>{t('p2p.create.typeLegend')}</legend>
        <div className={styles.typeToggle} role="radiogroup" aria-label={t('p2p.create.typeLegend')}>
          {(['buy', 'sell'] as OfferType[]).map((opt) => (
            <button
              key={opt}
              type="button"
              role="radio"
              value={opt}
              aria-checked={type === opt}
              onClick={() => setType(opt)}
              className={`${styles.typeOpt}${type === opt ? ` ${styles.typeOptOn}` : ''}`}
            >
              {t(opt === 'buy' ? 'p2p.create.typeBuy' : 'p2p.create.typeSell')}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Crypto — custom Select (searchable) */}
      <div className={styles.fieldBlock}>
        <span className={styles.fieldLabel} id="create-offer-crypto-label">{t('p2p.create.crypto')}</span>
        <Select
          options={cryptoOptions}
          value={cryptoId || null}
          onChange={setCryptoId}
          searchable
          placeholder={t('p2p.create.cryptoPlaceholder')}
          aria-label={t('p2p.create.crypto')}
          aria-labelledby="create-offer-crypto-label"
        />
      </div>

      <Field label={t('p2p.create.min')}>
        <Input id="create-offer-min" inputMode="decimal" value={rawMin} onChange={(e) => setRawMin(e.target.value)} autoComplete="off" placeholder="0" />
      </Field>

      <Field label={t('p2p.create.max')}>
        <Input id="create-offer-max" inputMode="decimal" value={rawMax} onChange={(e) => setRawMax(e.target.value)} autoComplete="off" placeholder="0" />
      </Field>

      {minGtMax && <p role="alert" className={styles.alert}>{t('p2p.create.minGtMax')}</p>}

      <Field label={t('p2p.create.unitPrice')}>
        <Input id="create-offer-price" inputMode="decimal" value={rawPrice} onChange={(e) => setRawPrice(e.target.value)} autoComplete="off" placeholder="0" />
      </Field>

      <Field label={t('p2p.create.fiatCurrency')}>
        <Input id="create-offer-fiat" value={fiatCurrency} onChange={(e) => setFiatCurrency(e.target.value)} maxLength={3} autoComplete="off" placeholder="USD" />
      </Field>

      {/* Payment methods — toggle chips (multi-select, no native multi-select) */}
      <div className={styles.fieldBlock}>
        <span className={styles.fieldLabel} id="create-offer-methods-label">{t('p2p.create.paymentMethods')}</span>
        <div className={styles.chips} role="group" aria-labelledby="create-offer-methods-label">
          {activeMethods.map((m) => {
            const on = metodosPagoIds.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleMethod(m.id)}
                className={`${styles.chip}${on ? ` ${styles.chipOn}` : ''}`}
              >
                {m.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Direccion fiat — required and shown ONLY for sell */}
      {type === 'sell' && (
        <Field label={t('p2p.create.direccionFiat')} helpText={t('p2p.create.direccionFiatHelp')}>
          <Input id="create-offer-direccion" value={direccionFiat} onChange={(e) => setDireccionFiat(e.target.value)} autoComplete="off" />
        </Field>
      )}

      {/* Additional terms (optional) */}
      <Field label={t('p2p.create.terms')}>
        <Textarea id="create-offer-terms" value={additionalTerms} onChange={(e) => setAdditionalTerms(e.target.value)} rows={3} />
      </Field>

      {mutation.isError && mutation.error != null && (
        <p role="alert" className={styles.alert}>
          {tError(mutation.error.code ?? 'FALLBACK_UNKNOWN_ERROR', { requestId: mutation.error.requestId ?? '' })}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={!canSubmit} loading={mutation.isPending}>
          {t('p2p.create.submit')}
        </Button>
      </div>
    </form>
  );
}
