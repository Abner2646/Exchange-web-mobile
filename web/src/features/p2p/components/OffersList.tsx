'use client';

import { useMemo, useState } from 'react';
import { formatDisplay } from '@/shared/money';
import { useTranslation } from '@/shared/i18n';
import { Button } from '@/shared/ui';
import { useActiveOffers, useCryptoCatalog } from '../queries';
import type { Offer, OfferType } from '../types';
import styles from './p2p.module.css';

export function OffersList({ onSelectOffer }: { onSelectOffer: (offer: Offer) => void }) {
  const { t, locale } = useTranslation();
  const { data: offers, isLoading, isError } = useActiveOffers();
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

  // Collect unique cryptoIds across ALL offers for the filter select (not tab-filtered)
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
    (o) =>
      o.type === activeTab &&
      (cryptoFilter === '' || o.cryptoId === cryptoFilter),
  );

  // --- Render states ---
  if (isLoading) return <p className={styles.label}>{t('common.loading')}</p>;

  if (isError) {
    return (
      <p role="alert" className={styles.error}>
        {t('p2p.offers.error')}
      </p>
    );
  }

  return (
    <section className={styles.panel}>
      {/* Buy / sell tab toggle */}
      <div className={styles.tabs} role="tablist">
        {(['sell', 'buy'] as OfferType[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`${styles.tab}${activeTab === tab ? ` ${styles.tabActive}` : ''}`}
          >
            {t(tab === 'buy' ? 'p2p.offers.typeBuy' : 'p2p.offers.typeSell')}
          </button>
        ))}
      </div>

      {/* Crypto filter */}
      <div className={styles.filterRow}>
        <label htmlFor="p2p-crypto-filter" className={styles.filterLabel}>
          {t('p2p.offers.filterByCrypto')}
        </label>
        <select
          id="p2p-crypto-filter"
          className={styles.filterSelect}
          value={cryptoFilter}
          onChange={(e) => setCryptoFilter(e.target.value)}
        >
          <option value="">{t('p2p.offers.tabAll')}</option>
          {cryptoOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <p className={styles.empty}>{t('p2p.offers.empty')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('p2p.offers.typeBuy')}/{t('p2p.offers.typeSell')}</th>
              <th>{t('p2p.offers.asset')}</th>
              <th>{t('p2p.offers.price')}</th>
              <th>{t('p2p.offers.range')}</th>
              <th>{t('p2p.offers.paymentMethods')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((offer) => (
              <tr key={offer.id}>
                <td>
                  <span className={offer.type === 'buy' ? styles.typeBuy : styles.typeSell}>
                    {t(offer.type === 'buy' ? 'p2p.offers.typeBuy' : 'p2p.offers.typeSell')}
                  </span>
                </td>
                <td>{resolveSymbol(offer.cryptoId)}</td>
                <td className={styles.price}>
                  {formatDisplay(offer.unitPrice, { locale, maxDecimals: 8, stripTrailingZeros: true })}{' '}
                  {offer.fiatCurrency}
                </td>
                <td className={styles.range}>
                  {formatDisplay(offer.minAmount, { locale, maxDecimals: 8, stripTrailingZeros: true })}
                  {'–'}
                  {formatDisplay(offer.maxAmount, { locale, maxDecimals: 8, stripTrailingZeros: true })}
                </td>
                <td>{offer.paymentMethods.map((pm) => pm.name).join(', ')}</td>
                <td>
                  <Button
                    type="button"
                    variant="primary"
                    size="small"
                    onClick={() => onSelectOffer(offer)}
                  >
                    {t('p2p.offers.accept')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
