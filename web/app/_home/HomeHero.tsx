'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { session } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useCurrentUser } from '@/features/auth/queries';
import { useMyBalances } from '@/features/wallet/queries';
import { CoinLogo } from '@/shared/ui';
import { useMarkets, formatPct } from './coingecko';
import { TopGainers } from './TopGainers';
import styles from '../marketing.module.css';

const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

function trimAmount(s: string): string {
  const n = Number(s);
  if (!isFinite(n)) return s;
  return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
}
const usd = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function MarketingHero() {
  const { t } = useTranslation();
  return (
    <div className={styles.heroContent}>
      <h1 className={styles.title}>
        {t('home.hero.titleLead')} <span className={styles.titleAccent}>{t('home.hero.titleAccent')}</span>
      </h1>
      <p className={styles.subtitle}>{t('home.hero.subtitle')}</p>
      <div className={styles.actions}>
        <Link href="/register" className={styles.ctaPrimary}>{t('home.hero.ctaPrimary')}</Link>
        <a href="#markets" className={styles.ctaSecondary}>{t('home.hero.ctaSecondary')}</a>
      </div>
    </div>
  );
}

function Pct({ v }: { v: number | null }) {
  const { text, sign } = formatPct(v);
  const cls = sign === 'pos' ? styles.positive : sign === 'neg' ? styles.negative : styles.neutral;
  return <span className={cls}>{text}</span>;
}

function DashboardHero({ name }: { name: string }) {
  const { t } = useTranslation();
  const { data: balances, isLoading, isError, refetch } = useMyBalances();
  const { data: markets, isError: marketsError } = useMarkets();

  const priceBySymbol = new Map<string, number>();
  const change24hBySymbol = new Map<string, number>();
  (markets ?? []).forEach((c) => {
    if (!c.symbol) return;
    const key = c.symbol.toLowerCase();
    if (c.current_price != null) priceBySymbol.set(key, c.current_price);
    if (c.price_change_percentage_24h != null) change24hBySymbol.set(key, c.price_change_percentage_24h);
  });
  // Live USD values depend on CoinGecko. If it hasn't returned any prices we must
  // NOT render a misleading "$0.00" total — show the holdings without USD + a note.
  const pricesAvailable = priceBySymbol.size > 0;

  const holdings = (balances ?? [])
    .map((b) => {
      const sym = b.crypto?.symbol ?? '';
      const amount = Number(b.availableBalance ?? '0');
      const key = sym.toLowerCase();
      const price = priceBySymbol.get(key) ?? 0;
      return {
        symbol: sym.toUpperCase(),
        raw: b.availableBalance ?? '0',
        amount,
        usdValue: amount * price,
        change24h: change24hBySymbol.get(key) ?? null,
      };
    })
    .filter((h) => h.amount > 0)
    .sort((a, b) => b.usdValue - a.usdValue);
  const total = holdings.reduce((s, h) => s + h.usdValue, 0);

  // Portfolio's 24h P&L: value now vs value 24h ago (price_24h_ago = price / (1 + pct/100)),
  // summed across holdings. The % is the weighted change over the 24h-ago total.
  const value24hAgo = holdings.reduce((s, h) => s + h.usdValue / (1 + (h.change24h ?? 0) / 100), 0);
  const changeUsd = total - value24hAgo;
  const changePct = value24hAgo > 0 ? (changeUsd / value24hAgo) * 100 : 0;

  return (
    <div className={styles.heroContent}>
      <h1 className={styles.title}>
        {t('home.dashboard.greeting')} <span className={styles.titleAccent}>{name || t('home.dashboard.traderFallback')}</span>
      </h1>

      <div className={styles.portfolioCard}>
        <div className={styles.portfolioLabel}>{t('home.dashboard.portfolioLabel')}</div>
        {isLoading ? (
          <span className={styles.skel} style={{ width: 200, height: 34, display: 'block' }} />
        ) : isError ? (
          <div className={styles.marketsError} role="alert">
            <p>{t('home.dashboard.balanceError')}</p>
            <button type="button" className={styles.marketsRetry} onClick={() => refetch()}>{t('common.retry')}</button>
          </div>
        ) : holdings.length === 0 ? (
          <>
            <div className={styles.portfolioTotal}>{usd(0)}</div>
            <p className={styles.portfolioEmpty}>{t('home.dashboard.empty')}</p>
            <Link href="/swap" className={`${styles.ctaPrimary} ${styles.portfolioEmptyCta}`}>{t('home.dashboard.emptyCta')}</Link>
          </>
        ) : (
          <>
            <div className={styles.portfolioTotal}>{pricesAvailable ? usd(total) : '—'}</div>
            {pricesAvailable && total > 0 && (
              <div className={`${styles.portfolioChange} ${changeUsd >= 0 ? styles.positive : styles.negative}`}>
                {changeUsd >= 0 ? '+' : '−'}{usd(Math.abs(changeUsd))} (<Pct v={changePct} />) {t('home.dashboard.today')}
              </div>
            )}
            {!pricesAvailable && (
              <p className={styles.portfolioEmpty}>
                {marketsError ? t('home.dashboard.pricesUnavailable') : t('home.dashboard.pricesLoading')}
              </p>
            )}
            <ul className={styles.portfolioList}>
              {holdings.slice(0, 4).map((h) => (
                <li key={h.symbol} className={styles.portfolioItem}>
                  <CoinLogo symbol={h.symbol} size={30} />
                  <div className={styles.portfolioMeta}>
                    <span className={styles.portfolioSym}>{h.symbol}</span>
                    <span className={styles.portfolioAmt}>{trimAmount(h.raw)}</span>
                  </div>
                  <div className={styles.portfolioValues}>
                    <span className={styles.portfolioUsd}>{pricesAvailable ? usd(h.usdValue) : '—'}</span>
                    {pricesAvailable && h.change24h != null && <Pct v={h.change24h} />}
                  </div>
                </li>
              ))}
            </ul>
            {holdings.length > 4 && (
              <Link href="/wallet" className={styles.portfolioViewAll}>
                {t('home.dashboard.viewAll', { count: holdings.length })}
              </Link>
            )}
          </>
        )}
      </div>

      <div className={styles.actions}>
        <Link href="/swap" className={styles.ctaPrimary}>{t('home.dashboard.actionSwap')}</Link>
        <Link href="/trading" className={styles.ctaSecondary}>{t('home.dashboard.actionTrade')}</Link>
        <Link href="/wallet" className={styles.ctaSecondary}>{t('home.dashboard.actionDeposit')}</Link>
      </div>
    </div>
  );
}

export function HomeHero() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setAuthed(session.hasToken());
    const unsub = session.onUnauthorized(() => setAuthed(false));
    return () => { unsub(); };
  }, []);
  const { data: user } = useCurrentUser();
  const name = cap(user?.displayName || user?.username || '');

  return (
    <section className={styles.hero}>
      {authed ? <DashboardHero name={name} /> : <MarketingHero />}
      <TopGainers />
    </section>
  );
}
