import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Rajdhani, Inter, Roboto_Mono } from 'next/font/google';
import styles from './v3.module.css';
import Faq from '../../_home/Faq';
import AppQr from '../../_home/AppQr';
import { FEATURE_ICONS } from '../../_home/icons';
import { MARKET, GAINERS, FEATURES, REGION_NOTICE, iconUrl } from '../../_home/data';

const display = Rajdhani({ subsets: ['latin'], weight: ['500', '600', '700'] });
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600'] });
const numFont = Roboto_Mono({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-num' });

export const metadata: Metadata = {
  title: 'BitFlow — V3 Binance-dense (dark)',
  robots: { index: false, follow: false },
};

/* V3 "pro terminal" (dark/gold): data-forward, dense, the markets table is the
   protagonist. Display = Rajdhani (condensed, terminal); figures = Roboto Mono.
   Tokens scoped as CSS vars on .page. */
const theme = {
  '--bg': '#0B0E11',
  '--surface': '#161A1E',
  '--surface-2': '#1E2329',
  '--ink': '#EAECEF',
  '--ink-soft': '#B7BDC6',
  '--muted': '#848E9C',
  '--line': '#2B3139',
  '--gold': '#F0B90B',
  '--gold-dark': '#D9A400',
  '--gold-wash': 'rgba(240, 185, 11, 0.12)',
  '--success': '#0ECB81',
  '--error': '#F6465D',
  '--neutral': '#848E9C',
} as CSSProperties;

function Pct({ v }: { v: number }) {
  const cls = v > 0 ? styles.positive : v < 0 ? styles.negative : styles.neutral;
  return <span className={cls}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>;
}

export default function HomeV3() {
  return (
    <div className={`${styles.page} ${body.className} ${numFont.variable}`} style={theme}>
      <header className={styles.header}>
        <span className={`${styles.brand} ${display.className}`}>BitFlow</span>
        <nav className={styles.headerNav} aria-label="Primary">
          <Link href="/login" className={styles.navLink}>Iniciar sesión</Link>
          <Link href="/register" className={styles.ctaSmall}>Crear cuenta</Link>
        </nav>
      </header>

      {/* Live ticker strip — the subject's most characteristic surface */}
      <div className={styles.ticker} aria-label="Precios de mercado">
        {MARKET.map((c) => (
          <div key={c.symbol} className={styles.tickerItem}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.tickerIcon} src={iconUrl(c.symbol)} alt="" width={18} height={18} loading="lazy" />
            <span className={styles.tickerSym}>{c.symbol}</span>
            <span className={styles.tickerPrice}>${c.price}</span>
            <Pct v={c.change24h} />
          </div>
        ))}
      </div>

      <main>
        {/* Hero (compact) */}
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={`${styles.title} ${display.className}`}>
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

          <aside className={styles.gainersCard}>
            <div className={styles.gainersHeader}>
              <h3 className={display.className}>Top ganadores</h3>
              <span className={styles.gainersBadge}>24 h</span>
            </div>
            <div className={styles.gainersList}>
              {GAINERS.map((c) => (
                <div key={c.symbol} className={styles.gainersItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.coinIcon} src={iconUrl(c.symbol)} alt="" width={22} height={22} loading="lazy" />
                  <span className={styles.gainersSymbol}>{c.symbol}</span>
                  <span className={styles.gainersPrice}>${c.price}</span>
                  <span className={styles.gainersChange}>+{c.change.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </aside>
        </section>

        {/* Markets — protagonist */}
        <section className={styles.section} id="markets">
          <div className={styles.sectionHead}>
            <h2 className={`${styles.sectionTitle} ${display.className}`}>Mercados populares</h2>
            <span className={styles.sectionMeta}>Precios en vivo · USD</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Par</th>
                  <th className={styles.thNum}>Último precio</th>
                  <th className={styles.thNum}>24 h %</th>
                  <th className={styles.thNum}>7 d %</th>
                  <th className={`${styles.thNum} ${styles.thHideSm}`}>Volumen 24 h</th>
                  <th className={`${styles.thNum} ${styles.thHideSm}`}>Cap. de mercado</th>
                </tr>
              </thead>
              <tbody>
                {MARKET.map((c) => (
                  <tr key={c.symbol} className={styles.row}>
                    <td className={styles.coinCell}>
                      <div className={styles.coinInfo}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className={styles.coinIcon} src={iconUrl(c.symbol)} alt="" width={26} height={26} loading="lazy" />
                        <div>
                          <span className={styles.coinSymbol}>{c.symbol}</span>
                          <span className={styles.coinName}>{c.name}</span>
                        </div>
                      </div>
                    </td>
                    <td className={styles.priceCell}>${c.price}</td>
                    <td className={styles.changeCell}><Pct v={c.change24h} /></td>
                    <td className={styles.changeCell}><Pct v={c.change7d} /></td>
                    <td className={`${styles.numCell} ${styles.thHideSm}`}>{c.volume}</td>
                    <td className={`${styles.numCell} ${styles.thHideSm}`}>{c.marketCap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Download */}
        <section className={styles.download}>
          <div className={styles.downloadInner}>
            <div className={styles.downloadContent}>
              <h2 className={`${styles.downloadTitle} ${display.className}`}>Opera desde cualquier lugar.</h2>
              <p className={styles.downloadSubtitle}>Tu exchange favorito, en tu bolsillo.</p>
              <div className={styles.qrRow}>
                <div className={styles.qrBox}>
                  <AppQr value={REGION_NOTICE} fgColor="#0B0E11" />
                </div>
                <div>
                  <p className={styles.notAvailable}>App móvil no disponible en tu región</p>
                  <p className={styles.qrHint}>Escaneá el código para más información.</p>
                </div>
              </div>
            </div>
            <div className={styles.downloadMockup}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/mockup-app.png" alt="BitFlow mobile app" className={styles.downloadMockupImg} />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className={styles.faq}>
          <h2 className={`${styles.sectionTitle} ${display.className}`}>Preguntas frecuentes</h2>
          <Faq styles={styles} />
        </section>

        {/* Why us */}
        <section className={styles.features}>
          <h2 className={`${styles.sectionTitle} ${display.className}`}>¿Por qué elegirnos?</h2>
          <div className={styles.featuresGrid}>
            {FEATURES.map((f, i) => (
              <article key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{FEATURE_ICONS[i]}</div>
                <h3 className={display.className}>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>© BitFlow — custodial exchange. Activos de mainnet en custodia.</p>
      </footer>
    </div>
  );
}
