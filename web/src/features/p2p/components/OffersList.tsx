'use client';

import { useMemo, useState } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { Badge, Button, CoinLogo, EmptyState, ErrorState, Skeleton } from '@/shared/ui';
import { useActiveOffers, useCryptoCatalog } from '../queries';
import type { Offer, OfferType } from '../types';
import styles from './p2p.module.css';

export function OffersList({ onSelectOffer }: { onSelectOffer: (offer: Offer) => void }) {
  const { t, locale } = useTranslation();
  const { data: offers, isLoading, isError, refetch } = useActiveOffers();
  const { data: cryptos } = useCryptoCatalog();

  const [activeTab, setActiveTab] = useState<OfferType>('sell');
  const [cryptoFilter, setCryptoFilter] = useState<string>('');

  // Build symbol lookup map from catalog
  const symbolMap = useMemo(() => {
    const map = new Map<string, string>();
    (cryptos ?? []).forEach((c) => map.set(c.id, c.symbol));
    return map;
  }, [cryptos]);

  const resolveSymbol = (cryptoId: string): string =>
    symbolMap.get(cryptoId) ?? cryptoId.slice(0, 8);

  const allOffers = offers ?? [];

  // Collect unique cryptoIds across ALL offers for the filter pills (not tab-filtered)
  const cryptoOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { id: string; label: string }[] = [];
    allOffers.forEach((o) => {
      if (!seen.has(o.cryptoId)) {
        seen.add(o.cryptoId);
        opts.push({ id: o.cryptoId, label: resolveSymbol(o.cryptoId) });
      }
    });
    return opts;
    // resolveSymbol is stable per render (depends on symbolMap which is memoized)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOffers, symbolMap]);

  const filtered = allOffers.filter(
    (o) => o.type === activeTab && (cryptoFilter === '' || o.cryptoId === cryptoFilter),
  );

  const fmt = (v: string) => formatDisplay(v, { locale, maxDecimals: 8, stripTrailingZeros: true });

  // --- Render states ---
  if (isLoading) {
    return (
      <div role="status" aria-label={t('common.loading')}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skelRow}>
            <Skeleton variant="circle" width={24} height={24} />
            <Skeleton variant="text" width="30%" />
            <Skeleton variant="text" width={80} />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title={t('p2p.offers.error')}
        onRetry={() => refetch()}
        retryLabel={t('common.retry')}
      />
    );
  }

  return (
    <section>
      {/* Buy / sell segmented toggle + crypto filter pills */}
      <div className={styles.toolbar}>
        <div className={styles.segmented} role="tablist" aria-label={t('p2p.offers.filterByType')}>
          {(['sell', 'buy'] as OfferType[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`${styles.seg}${
                activeTab === tab ? ` ${tab === 'buy' ? styles.segBuy : styles.segSell}` : ''
              }`}
            >
              {t(tab === 'buy' ? 'p2p.offers.typeBuy' : 'p2p.offers.typeSell')}
            </button>
          ))}
        </div>

        {cryptoOptions.length > 0 && (
          <div className={styles.filterPills}>
            <span className={styles.filterLabel}>{t('p2p.offers.filterByCrypto')}</span>
            <button
              type="button"
              aria-pressed={cryptoFilter === ''}
              onClick={() => setCryptoFilter('')}
              className={`${styles.pill}${cryptoFilter === '' ? ` ${styles.pillActive}` : ''}`}
            >
              {t('p2p.offers.tabAll')}
            </button>
            {cryptoOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={cryptoFilter === opt.id}
                onClick={() => setCryptoFilter(opt.id)}
                className={`${styles.pill}${cryptoFilter === opt.id ? ` ${styles.pillActive}` : ''}`}
              >
                <CoinLogo symbol={opt.label} size={16} />
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState title={t('p2p.offers.empty')} message={t('p2p.offers.emptyHint')} />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('p2p.offers.type')}</th>
              <th>{t('p2p.offers.asset')}</th>
              <th>{t('p2p.offers.price')}</th>
              <th>{t('p2p.offers.range')}</th>
              <th className={styles.colMethods}>{t('p2p.offers.paymentMethods')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((offer) => {
              const symbol = resolveSymbol(offer.cryptoId);
              return (
                <tr key={offer.id}>
                  <td>
                    <Badge tone={offer.type === 'buy' ? 'success' : 'error'}>
                      {t(offer.type === 'buy' ? 'p2p.offers.typeBuy' : 'p2p.offers.typeSell')}
                    </Badge>
                  </td>
                  <td>
                    <span className={styles.coinCell}>
                      <CoinLogo symbol={symbol} size={22} />
                      <span className={styles.coinSym}>{symbol}</span>
                    </span>
                  </td>
                  <td className={styles.num}>
                    {fmt(offer.unitPrice)} {offer.fiatCurrency}
                  </td>
                  <td className={styles.range}>
                    {fmt(offer.minAmount)}–{fmt(offer.maxAmount)} {symbol}
                  </td>
                  <td className={styles.methodsCell}>
                    {offer.paymentMethods.map((pm) => pm.name).join(', ')}
                  </td>
                  <td>
                    <Button type="button" variant="primary" size="small" onClick={() => onSelectOffer(offer)}>
                      {t('p2p.offers.accept')}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
