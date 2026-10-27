'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { session } from '@/shared/api';
import { useCurrentUser } from '@/features/auth/queries';
import { useMyBalances } from '@/features/wallet/queries';
import { useMarkets } from './coingecko';
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
  return (
    <div className={styles.heroContent}>
      <h1 className={styles.title}>
        Tu plataforma definitiva para trading de <span className={styles.titleAccent}>criptomonedas</span>
      </h1>
      <p className={styles.subtitle}>
        Opera con más de 200 activos digitales de forma segura, rápida y confiable. Únete a miles de
        traders que ya confían en nosotros.
      </p>
      <div className={styles.actions}>
        <Link href="/register" className={styles.ctaPrimary}>Empezar ahora</Link>
        <a href="#markets" className={styles.ctaSecondary}>Ver mercados</a>
      </div>
    </div>
  );
}

function DashboardHero({ name }: { name: string }) {
  const { data: balances, isLoading, isError, refetch } = useMyBalances();
  const { data: markets } = useMarkets();

  const priceBySymbol = new Map<string, number>();
  (markets ?? []).forEach((c) => {
    if (c.symbol && c.current_price != null) priceBySymbol.set(c.symbol.toLowerCase(), c.current_price);
  });

  const holdings = (balances ?? [])
    .map((b) => {
      const sym = b.crypto?.symbol ?? '';
      const amount = Number(b.availableBalance ?? '0');
      const price = priceBySymbol.get(sym.toLowerCase()) ?? 0;
      return { symbol: sym.toUpperCase(), raw: b.availableBalance ?? '0', amount, usdValue: amount * price };
    })
    .filter((h) => h.amount > 0)
    .sort((a, b) => b.usdValue - a.usdValue);
  const total = holdings.reduce((s, h) => s + h.usdValue, 0);

  return (
    <div className={styles.heroContent}>
      <h1 className={styles.title}>
        Hola de nuevo, <span className={styles.titleAccent}>{name || 'trader'}</span>
      </h1>

      <div className={styles.portfolioCard}>
        <div className={styles.portfolioLabel}>Valor estimado de tu cartera</div>
        {isLoading ? (
          <span className={styles.skel} style={{ width: 200, height: 34, display: 'block' }} />
        ) : isError ? (
          <div className={styles.marketsError} role="alert">
            <p>No pudimos cargar tus balances.</p>
            <button type="button" className={styles.marketsRetry} onClick={() => refetch()}>Reintentar</button>
          </div>
        ) : (
          <>
            <div className={styles.portfolioTotal}>{usd(total)}</div>
            {holdings.length === 0 ? (
              <p className={styles.portfolioEmpty}>Todavía no tenés fondos. Hacé tu primer depósito para empezar.</p>
            ) : (
              <ul className={styles.portfolioList}>
                {holdings.slice(0, 4).map((h) => (
                  <li key={h.symbol} className={styles.portfolioItem}>
                    <span className={styles.portfolioSym}>{h.symbol}</span>
                    <span className={styles.portfolioAmt}>{trimAmount(h.raw)}</span>
                    <span className={styles.portfolioUsd}>{usd(h.usdValue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className={styles.actions}>
        <Link href="/wallet" className={styles.ctaPrimary}>Mi billetera</Link>
        <Link href="/swap" className={styles.ctaSecondary}>Intercambiar</Link>
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
