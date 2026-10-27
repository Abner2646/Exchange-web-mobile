'use client';

import { useMarkets, formatPrice, formatPct } from './coingecko';
import styles from '../marketing.module.css';

export function TopGainers() {
  const { data, isLoading } = useMarkets();
  const gainers = (data ?? [])
    .filter((c) => (c.price_change_percentage_24h ?? 0) > 0)
    .sort((a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0))
    .slice(0, 5);

  return (
    <aside className={styles.gainersSection}>
      <div className={styles.gainersCard}>
        <div className={styles.gainersHeader}>
          <svg className={styles.gainersIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5l7 8h-4v6h-6v-6H5l7-8z" /></svg>
          <h3>Top Ganadores (24hs)</h3>
        </div>
        <div className={styles.gainersList}>
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={`sk-${i}`} className={styles.gainersItem}>
                <span className={styles.skel} style={{ width: 28, height: 28, borderRadius: '50%' }} />
                <span className={styles.skel} style={{ width: 70, height: 14 }} />
              </div>
            ))}
          {!isLoading &&
            gainers.map((c) => (
              <div key={c.id} className={styles.gainersItem}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={styles.coinIcon} src={c.image || ''} alt="" width={28} height={28} loading="lazy" />
                <div className={styles.gainersInfo}>
                  <span className={styles.gainersSymbol}>{(c.symbol || '').toUpperCase()}</span>
                  <span className={styles.gainersPrice}>{formatPrice(c.current_price)}</span>
                </div>
                <span className={styles.gainersChange}>{formatPct(c.price_change_percentage_24h).text}</span>
              </div>
            ))}
        </div>
      </div>
    </aside>
  );
}
