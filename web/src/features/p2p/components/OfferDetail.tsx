'use client';

import { useMemo } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { Badge, Button, CoinLogo } from '@/shared/ui';
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

  const symbol = symbolMap.get(offer.cryptoId) ?? offer.cryptoId.slice(0, 8);
  const fmt = (v: string) => formatDisplay(v, { locale, maxDecimals: 8, stripTrailingZeros: true });

  return (
    <section className={styles.form}>
      {/* Header: coin + type badge */}
      <div className={styles.cardTitle}>
        <CoinLogo symbol={symbol} size={28} />
        <span className={styles.coinSym}>{symbol}</span>
        <Badge tone={offer.type === 'buy' ? 'success' : 'error'}>
          {t(offer.type === 'buy' ? 'p2p.offers.typeBuy' : 'p2p.offers.typeSell')}
        </Badge>
      </div>

      <div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>{t('p2p.offers.price')}</span>
          <span className={`${styles.detailValue} ${styles.money}`}>
            {fmt(offer.unitPrice)} {offer.fiatCurrency}
          </span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>{t('p2p.offers.range')}</span>
          <span className={`${styles.detailValue} ${styles.money}`}>
            {fmt(offer.minAmount)}–{fmt(offer.maxAmount)} {symbol}
          </span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>{t('p2p.offers.paymentMethods')}</span>
          <span className={styles.detailValue}>
            {offer.paymentMethods.map((pm) => pm.name).join(', ')}
          </span>
        </div>
        {offer.additionalTerms && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>{t('p2p.offers.terms')}</span>
            <span className={styles.detailValue}>{offer.additionalTerms}</span>
          </div>
        )}
        {offer.type === 'sell' && offer.direccionFiat && (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>{t('p2p.detail.sellerAddress')}</span>
            <span className={styles.detailValue}>{offer.direccionFiat}</span>
          </div>
        )}
      </div>

      {!offer.active && <p className={styles.alert}>{t('p2p.detail.inactive')}</p>}

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
