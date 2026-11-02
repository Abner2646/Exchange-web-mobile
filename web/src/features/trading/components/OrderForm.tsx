'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { parseInput, compare, multiply, add, divide, round, formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Input, useSuccessFlash } from '@/shared/ui';
import { useMyBalances } from '@/features/wallet/queries';
import { usePairs, usePlaceOrder } from '../queries';
import type { OrderSide, OrderType } from '../types';
import styles from './trading.module.css';

/** Floor a canonical decimal string to `dp` places — never rounds UP (so a "Max"
 *  can't exceed the real balance, and we never send more precision than the pair keeps). */
function truncateTo(v: string, dp: number): string {
  const [i, f = ''] = v.split('.');
  if (dp <= 0) return i;
  return f.length > dp ? `${i}.${f.slice(0, dp)}` : v;
}

export default function OrderForm({ pairId }: { pairId: string }) {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const { flash } = useSuccessFlash();
  const { data: pairs } = usePairs();
  const { data: balances } = useMyBalances();
  const place = usePlaceOrder();

  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [side, setSide] = useState<OrderSide>('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

  const pair = useMemo(() => (pairs ?? []).find((p) => p.id === pairId), [pairs, pairId]);
  const parsedQty = useMemo(() => parseInput(quantity, { locale }), [quantity, locale]);
  const parsedPrice = useMemo(() => parseInput(price, { locale }), [price, locale]);
  const fmt = (v: string) => formatDisplay(v, { locale, maxDecimals: 8, stripTrailingZeros: true });

  const qtyOk = parsedQty.ok && compare(parsedQty.value, '0') > 0;
  const priceNeeded = orderType === 'limit';
  const priceOk = !priceNeeded || (parsedPrice.ok && compare(parsedPrice.value, '0') > 0);
  const aboveMin = qtyOk && pair ? compare(parsedQty.value, pair.minOrderAmount) >= 0 : false;

  // Needed asset per side: buy spends quote, sell spends base.
  const needAsset = pair ? (side === 'buy' ? pair.quoteAssetId : pair.baseAssetId) : null;
  const spotAvailable = useMemo(() => {
    if (!needAsset) return null;
    const entry = (balances ?? []).find((b) => b.criptomonedaId === needAsset);
    return entry?.compartments.spot?.available ?? null;
  }, [balances, needAsset]);

  // Required spend (canonical money only). Market buy can't be priced exactly up front.
  const requiredSpend = useMemo(() => {
    if (!pair || !qtyOk) return null;
    if (side === 'sell') return parsedQty.value; // base amount
    if (orderType === 'limit') {
      if (!priceOk || !parsedPrice.ok) return null;
      const notional = multiply(parsedQty.value, parsedPrice.value);
      const fee = multiply(notional, divide(pair.takerFeePercent, '100'));
      return add(notional, fee); // quote needed
    }
    return null; // market buy
  }, [pair, qtyOk, side, orderType, priceOk, parsedPrice, parsedQty]);

  const isMarketBuy = side === 'buy' && orderType === 'market';
  const insufficient = (() => {
    if (spotAvailable == null) return false;
    if (isMarketBuy) return compare(spotAvailable, '0') <= 0;
    if (requiredSpend == null) return false;
    return compare(requiredSpend, spotAvailable) > 0;
  })();

  const canSubmit =
    Boolean(pairId) && !!pair && pair.status === 'active' &&
    qtyOk && aboveMin && priceOk && spotAvailable != null && !insufficient && !place.isPending;

  const feeAsset = pair ? (side === 'buy' ? pair.baseSymbol : pair.quoteSymbol) : '';
  const feeNoteKey = side === 'buy' ? 'trading.form.feeNoteBuy' : 'trading.form.feeNoteSell';
  // Max only for a sell (base = Spot available, exact). Buy max depends on price+fee — omitted to keep it honest.
  const sellMax = side === 'sell' && pair && spotAvailable != null ? truncateTo(spotAvailable, pair.quantityPrecision) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !parsedQty.ok || !pair) return;
    const canonicalQty = round(parsedQty.value, pair.quantityPrecision);
    const req: { tradingPairId: string; orderType: OrderType; side: OrderSide; quantity: string; price?: string } = {
      tradingPairId: pairId, orderType, side, quantity: canonicalQty,
    };
    if (orderType === 'limit' && parsedPrice.ok) req.price = round(parsedPrice.value, pair.pricePrecision);
    try {
      await place.mutateAsync(req);
      flash({
        title: t('trading.form.flashTitle'),
        detail: t('trading.form.flashDetail', { qty: fmt(canonicalQty), base: pair.baseSymbol, action: t(side === 'buy' ? 'trading.form.buy' : 'trading.form.sell') }),
      });
      setQuantity('');
      setPrice('');
    } catch { /* surfaced below */ }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.panelTitle}>{t('trading.form.title')}</h2>

      {!pairId ? (
        <p className={styles.formHint}>{t('trading.form.pickPair')}</p>
      ) : (
        <>
          <div className={styles.segmented} role="group" aria-label={t('trading.form.side')}>
            <button type="button" aria-pressed={side === 'buy'} className={`${styles.seg} ${side === 'buy' ? styles.segBuy : ''}`} onClick={() => setSide('buy')}>{t('trading.form.buy')}</button>
            <button type="button" aria-pressed={side === 'sell'} className={`${styles.seg} ${side === 'sell' ? styles.segSell : ''}`} onClick={() => setSide('sell')}>{t('trading.form.sell')}</button>
          </div>

          <div className={styles.segmented} role="group" aria-label={t('trading.form.type')}>
            <button type="button" aria-pressed={orderType === 'limit'} className={`${styles.seg} ${orderType === 'limit' ? styles.segOn : ''}`} onClick={() => setOrderType('limit')}>{t('trading.form.limit')}</button>
            <button type="button" aria-pressed={orderType === 'market'} className={`${styles.seg} ${orderType === 'market' ? styles.segOn : ''}`} onClick={() => setOrderType('market')}>{t('trading.form.market')}</button>
          </div>

          <div className={styles.fieldBlock}>
            <div className={styles.fieldHead}>
              <label htmlFor="order-qty" className={styles.fieldLabel}>{t('trading.form.quantity')}</label>
              {sellMax != null && (
                <button type="button" className={styles.maxBtn} onClick={() => setQuantity(sellMax)}>
                  {t('trading.form.max')} <strong>{fmt(sellMax)}</strong> {pair?.baseSymbol}
                </button>
              )}
            </div>
            <Input id="order-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} autoComplete="off" placeholder="0" />
          </div>

          {orderType === 'limit' && (
            <div className={styles.fieldBlock}>
              <div className={styles.fieldHead}>
                <label htmlFor="order-price" className={styles.fieldLabel}>{t('trading.form.price')}</label>
                {pair?.lastPrice && (
                  <button type="button" className={styles.maxBtn} onClick={() => setPrice(pair.lastPrice)}>
                    {t('trading.form.priceLast', { price: fmt(pair.lastPrice) })}
                  </button>
                )}
              </div>
              <Input id="order-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} autoComplete="off" placeholder="0" />
            </div>
          )}

          {pair && <p className={styles.note}>{t(feeNoteKey, { asset: feeAsset, pct: pair.takerFeePercent })}</p>}
          {isMarketBuy && <p className={styles.note}>{t('trading.form.marketCostNote')}</p>}
          {pair && qtyOk && !aboveMin && (
            <p role="alert" className={styles.alert}>{t('trading.form.minAmount', { min: pair.minOrderAmount, asset: pair.baseSymbol })}</p>
          )}

          {insufficient && (
            <div role="alert" className={styles.fundPrompt}>
              <span>{t('trading.form.insufficient')}</span>
              <span>{t('trading.form.fundSpot')} <Link href="/wallet">/wallet</Link></span>
            </div>
          )}
          {place.isError && place.error && (
            <p role="alert" className={styles.alert}>{tError(place.error.code, { requestId: place.error.requestId ?? '' })}</p>
          )}

          <div className={styles.actions}>
            <Button type="submit" variant={side === 'buy' ? 'primary' : 'danger'} disabled={!canSubmit} loading={place.isPending}>
              {t(side === 'buy' ? 'trading.form.submitBuy' : 'trading.form.submitSell')}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
