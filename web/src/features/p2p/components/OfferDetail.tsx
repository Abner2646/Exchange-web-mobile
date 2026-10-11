'use client';

import { useMemo } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import { useCryptoCatalog } from '../queries';
import type { Offer } from '../types';
import styles from './p2p.module.css';

export function OfferDetail({
  offer,
  onAccept,
}: {
  offer: Offer;
  onAccept?: () => void;
}) {
  const { t, locale } = useTranslation();
  const { data: cryptos } = useCryptoCatalog();

  const symbolMap = useMemo(() => {
    const map = new Map<string, string>();
    (cryptos ?? []).forEach((c) => map.set(c.id, c.symbol));
    return map;
  }, [cryptos]);

  const resolveSymbol = (cryptoId: string): string =>
    symbolMap.get(cryptoId) ?? cryptoId.slice(0, 8);

  const symbol = resolveSymbol(offer.cryptoId);

  return (
    <section className={styles.panel}>
      {/* Type badge */}
      <div>
        <span className={offer.type === 'buy' ? styles.typeBuy : styles.typeSell}>
          {t(offer.type === 'buy' ? 'p2p.offers.typeBuy' : 'p2p.offers.typeSell')}
        </span>
        {' '}
        <span>{symbol}</span>
      </div>

      {/* Price */}
      <div>
        <span className={styles.label}>{t('p2p.offers.price')}: </span>
        <span className={styles.price}>
          {formatDisplay(offer.unitPrice, { locale, maxDecimals: 8, stripTrailingZeros: true })}{' '}
          {offer.fiatCurrency}
        </span>
      </div>

      {/* Amount range */}
      <div>
        <span className={styles.label}>{t('p2p.offers.range')}: </span>
        <span className={styles.range}>
          {formatDisplay(offer.minAmount, { locale, maxDecimals: 8, stripTrailingZeros: true })}
          {'–'}
          {formatDisplay(offer.maxAmount, { locale, maxDecimals: 8, stripTrailingZeros: true })}
          {' '}
          {symbol}
        </span>
      </div>

      {/* Payment methods */}
      <div>
        <span className={styles.label}>{t('p2p.offers.paymentMethods')}: </span>
        <span>{offer.paymentMethods.map((pm) => pm.name).join(', ')}</span>
      </div>

      {/* Additional terms */}
      {offer.additionalTerms && (
        <div>
          <span className={styles.label}>{t('p2p.offers.terms')}: </span>
          <span>{offer.additionalTerms}</span>
        </div>
      )}

      {/* Seller's fiat-receive address — only for sell offers */}
      {offer.type === 'sell' && offer.direccionFiat && (
        <div>
          <span className={styles.label}>{t('p2p.detail.sellerAddress')}: </span>
          <span>{offer.direccionFiat}</span>
        </div>
      )}

      {/* Inactive note */}
      {!offer.active && (
        <p className={styles.error}>{t('p2p.detail.inactive')}</p>
      )}

      {/* Accept button */}
      {onAccept && (
        <Button
          type="button"
          variant="primary"
          disabled={!offer.active}
          onClick={offer.active ? onAccept : undefined}
        >
          {t('p2p.offers.accept')}
        </Button>
      )}
    </section>
  );
}
