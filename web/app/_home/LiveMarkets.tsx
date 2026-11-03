'use client';

import Link from 'next/link';
import { useTranslation } from '@/shared/i18n';
import { useMarkets, formatPrice, formatCompact, formatPct } from './coingecko';
import styles from '../marketing.module.css';

function Pct({ v }: { v: number | null }) {
  const { text, sign } = formatPct(v);
  const cls = sign === 'pos' ? styles.positive : sign === 'neg' ? styles.negative : styles.neutral;
  return <span className={cls}>{text}</span>;
}

export function LiveMarkets() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useMarkets();
  const coins = (data ?? []).slice(0, 10);

  return (
    <section className={styles.section} id="markets">
      <h2 className={styles.sectionTitle}>{t('home.markets.title')}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('home.markets.col.coin')}</th>
              <th className={styles.thCenter}>{t('home.markets.col.price')}</th>
              <th className={styles.thCenter}>{t('home.markets.col.change24h')}</th>
              <th className={styles.thCenter}>{t('home.markets.col.change7d')}</th>
              <th className={styles.thHideSm} style={{ textAlign: 'right' }}>{t('home.markets.col.volume')}</th>
              <th className={styles.thHideSm} style={{ textAlign: 'right' }}>{t('home.markets.col.marketCap')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 10 }).map((_, i) => (
                <tr key={`sk-${i}`} className={styles.row}>
                  <td className={styles.coinCell}>
                    <div className={styles.coinInfo}>
                      <span className={styles.skel} style={{ width: 30, height: 30, borderRadius: '50%' }} />
                      <span className={styles.skel} style={{ width: 90, height: 14 }} />
                    </div>
                  </td>
                  <td className={styles.priceCell}><span className={styles.skel} style={{ width: 64, height: 14, marginLeft: 'auto' }} /></td>
                  <td className={styles.changeCell}><span className={styles.skel} style={{ width: 48, height: 14, margin: '0 auto' }} /></td>
                  <td className={styles.changeCell}><span className={styles.skel} style={{ width: 48, height: 14, margin: '0 auto' }} /></td>
                  <td className={`${styles.numCell} ${styles.thHideSm}`}><span className={styles.skel} style={{ width: 70, height: 14, marginLeft: 'auto' }} /></td>
                  <td className={`${styles.numCell} ${styles.thHideSm}`}><span className={styles.skel} style={{ width: 80, height: 14, marginLeft: 'auto' }} /></td>
                </tr>
              ))}
            {!isLoading && !isError &&
              coins.map((c) => (
                <tr key={c.id} className={styles.row}>
                  <td className={styles.coinCell}>
                    <div className={styles.coinInfo}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={styles.coinIcon} src={c.image || ''} alt="" width={30} height={30} loading="lazy" />
                      <div>
                        <div className={styles.coinSymbol}>{(c.symbol || '').toUpperCase()}</div>
                        <div className={styles.coinName}>{c.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.priceCell}>{formatPrice(c.current_price)}</td>
                  <td className={styles.changeCell}><Pct v={c.price_change_percentage_24h} /></td>
                  <td className={styles.changeCell}><Pct v={c.price_change_percentage_7d_in_currency} /></td>
                  <td className={`${styles.numCell} ${styles.thHideSm}`}>{formatCompact(c.total_volume)}</td>
                  <td className={`${styles.numCell} ${styles.thHideSm}`}>{formatCompact(c.market_cap)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {isError && (
          <div className={styles.marketsError} role="alert">
            <p>{t('home.markets.error')}</p>
            <button type="button" onClick={() => refetch()} className={styles.marketsRetry}>{t('common.retry')}</button>
          </div>
        )}
      </div>
      <div className={styles.marketsMore}>
        <Link href="/trading" className={styles.marketsMoreLink}>{t('home.markets.viewAll')}</Link>
      </div>
    </section>
  );
}
