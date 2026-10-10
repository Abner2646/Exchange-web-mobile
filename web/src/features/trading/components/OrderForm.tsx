'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { parseInput, compare, multiply, add, divide } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useMyBalances } from '@/features/wallet/queries';
import { TradingPairSelect } from './TradingPairSelect';
import { usePairs, usePlaceOrder } from '../queries';
import type { OrderSide, OrderType } from '../types';
import styles from './trading.module.css';

export default function OrderForm() {
  const { t, locale } = useTranslation();
  const { tError } = useErrorTranslation();
  const { data: pairs } = usePairs();
  const { data: balances } = useMyBalances();
  const place = usePlaceOrder();

  const [pairId, setPairId] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('limit');
  const [side, setSide] = useState<OrderSide>('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

  const pair = useMemo(() => (pairs ?? []).find((p) => p.id === pairId), [pairs, pairId]);
  const parsedQty = useMemo(() => parseInput(quantity, { locale }), [quantity, locale]);
  const parsedPrice = useMemo(() => parseInput(price, { locale }), [price, locale]);

  const qtyOk = parsedQty.ok && compare(parsedQty.value, '0') > 0;
  const priceNeeded = orderType === 'limit';
  const priceOk = !priceNeeded || (parsedPrice.ok && compare(parsedPrice.value, '0') > 0);
  const aboveMin = qtyOk && pair ? compare(parsedQty.value, pair.minOrderAmount) >= 0 : false;

  // Needed asset per side: buy spends quote, sell spends base.
  const needAsset = pair ? (side === 'buy' ? pair.quoteAssetId : pair.baseAssetId) : null;
  const spotAvailable = useMemo(() => {
    if (!needAsset) return null;
    const entry = (balances ?? []).find((b) => b.criptomonedaId === needAsset);
    if (!entry) return null;
    return entry.compartments.spot?.available ?? null;
  }, [balances, needAsset]);

  // Required spend (canonical money only).
  const requiredSpend = useMemo(() => {
    if (!pair || !qtyOk) return null;
    if (side === 'sell') return parsedQty.ok ? parsedQty.value : null; // base amount
    // buy
    if (orderType === 'limit') {
      if (!priceOk || !parsedPrice.ok) return null;
      const notional = multiply(parsedQty.value, parsedPrice.value);
      const fee = multiply(notional, divide(pair.takerFeePercent, '100'));
      return add(notional, fee); // quote needed
    }
    return null; // market buy: cannot compute exactly
  }, [pair, qtyOk, side, orderType, priceOk, parsedPrice, parsedQty]);

  const isMarketBuy = side === 'buy' && orderType === 'market';
  const insufficient = (() => {
    if (spotAvailable == null) return false; // unknown handled by canSubmit
    if (isMarketBuy) return compare(spotAvailable, '0') <= 0; // soft: only block on zero
    if (requiredSpend == null) return false;
    return compare(requiredSpend, spotAvailable) > 0;
  })();

  const canSubmit =
    Boolean(pairId) &&
    !!pair &&
    pair.status === 'active' &&
    qtyOk &&
    aboveMin &&
    priceOk &&
    spotAvailable != null &&
    !insufficient &&
    !place.isPending;

  const feeAsset = pair ? (side === 'buy' ? pair.baseSymbol : pair.quoteSymbol) : '';
  const feeNoteKey = side === 'buy' ? 'trading.form.feeNoteBuy' : 'trading.form.feeNoteSell';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !parsedQty.ok) return;
    const req: { tradingPairId: string; orderType: OrderType; side: OrderSide; quantity: string; price?: string } = {
      tradingPairId: pairId,
      orderType,
      side,
      quantity: parsedQty.value,
    };
    if (orderType === 'limit' && parsedPrice.ok) req.price = parsedPrice.value;
    try {
      await place.mutateAsync(req);
      setQuantity('');
      setPrice('');
    } catch {
      // surfaced via place.error below
    }
  }

  const submitLabel = side === 'buy' ? 'trading.form.submitBuy' : 'trading.form.submitSell';

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2>{t('trading.form.title')}</h2>

      <TradingPairSelect value={pairId} onChange={setPairId} />

      <fieldset>
        <legend>{t('trading.form.type')}</legend>
        <label><input type="radio" name="otype" checked={orderType === 'limit'} onChange={() => setOrderType('limit')} /> {t('trading.form.limit')}</label>
        <label><input type="radio" name="otype" checked={orderType === 'market'} onChange={() => setOrderType('market')} /> {t('trading.form.market')}</label>
      </fieldset>

      <fieldset>
        <legend>{t('trading.form.side')}</legend>
        <label><input type="radio" name="side" aria-label={t('trading.form.buy')} checked={side === 'buy'} onChange={() => setSide('buy')} /> {t('trading.form.buy')}</label>
        <label><input type="radio" name="side" aria-label={t('trading.form.sell')} checked={side === 'sell'} onChange={() => setSide('sell')} /> {t('trading.form.sell')}</label>
      </fieldset>

      <Field label={t('trading.form.quantity')}>
        <input id="order-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} autoComplete="off" />
      </Field>

      {orderType === 'limit' && (
        <Field label={t('trading.form.price')}>
          <input id="order-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} autoComplete="off" />
        </Field>
      )}

      {pair && (
        <p className={styles.label}>{t(feeNoteKey, { asset: feeAsset, pct: pair.takerFeePercent })}</p>
      )}
      {isMarketBuy && <p className={styles.label}>{t('trading.form.marketCostNote')}</p>}
      {pair && qtyOk && !aboveMin && (
        <p role="alert" className={styles.label}>{t('trading.form.minAmount', { min: pair.minOrderAmount, asset: pair.baseSymbol })}</p>
      )}

      {insufficient && (
        <div role="alert" className={styles.fundPrompt}>
          <p className={styles.label}>{t('trading.form.insufficient')}</p>
          <p className={styles.label}>{t('trading.form.fundSpot')} <Link href="/wallet">/wallet</Link></p>
        </div>
      )}
      {place.isError && place.error && (
        <p role="alert" className={styles.label}>{tError((place.error as any).code, { requestId: (place.error as any).requestId ?? '' })}</p>
      )}
      {place.isSuccess && <p role="status" className={styles.label}>{t('trading.form.success')}</p>}

      <div className={styles.actions}>
        <Button type="submit" variant={side === 'buy' ? 'primary' : 'danger'} disabled={!canSubmit} loading={place.isPending}>
          {t(submitLabel)}
        </Button>
      </div>
    </form>
  );
}
