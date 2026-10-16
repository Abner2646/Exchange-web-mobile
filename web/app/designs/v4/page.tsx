import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Syne, Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import styles from './v4.module.css';
import Faq from '../../_home/Faq';
import AppQr from '../../_home/AppQr';
import { FEATURE_ICONS } from '../../_home/icons';
import { MARKET, GAINERS, FEATURES, REGION_NOTICE, iconUrl } from '../../_home/data';

const display = Syne({ subsets: ['latin'], weight: ['600', '700', '800'] });
const body = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });
const numFont = Space_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-num' });

export const metadata: Metadata = {
  title: 'BitFlow — V4 Fintech moderno (violet)',
  robots: { index: false, follow: false },
};

/* V4 "modern fintech" (dark violet): bold Syne display, high contrast, a single
   electric-violet accent carried by a gradient signature. Markets render as a
   rounded card-list rather than a dense grid. Figures = Space Grotesk.
   Tokens scoped as CSS vars on .page. */
const theme = {
  '--bg': '#0D0B14',
  '--surface': '#16131F',
  '--surface-2': '#1F1B2E',
  '--ink': '#F4F2FA',
  '--ink-soft': '#C5C0D6',
  '--muted': '#8A84A0',
  '--line': 'rgba(139, 92, 252, 0.16)',
  '--violet': '#8B5CF6',
  '--violet-bright': '#A78BFA',
  '--violet-wash': 'rgba(139, 92, 252, 0.14)',
  '--grad': 'linear-gradient(100deg, #A78BFA 0%, #8B5CF6 55%, #6D28D9 100%)',
  '--success': '#34D399',
  '--error': '#FB7185',
  '--neutral': '#8A84A0',
} as CSSProperties;

function Pct({ v }: { v: number }) {
  const cls = v > 0 ? styles.positive : v < 0 ? styles.negative : styles.neutral;
  return <span className={cls}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>;
}

export default function HomeV4() {
  return (
    <div className={`${styles.page} ${body.className} ${numFont.variable}`} style={theme}>
      <div className={styles.glow} aria-hidden="true" />
      <header className={styles.header}>
        <span className={`${styles.brand} ${display.className}`}>BitFlow</span>
        <nav className={styles.headerNav} aria-label="Primary">
          <Link href="/login" className={styles.navLink}>Iniciar sesión</Link>
          <Link href="/register" className={styles.ctaSmall}>Crear cuenta</Link>
        </nav>
      </header>

      <main>
        {/* Hero — oversized */}
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
                  <img className={styles.coinIcon} src={iconUrl(c.symbol)} alt="" width={24} height={24} loading="lazy" />
                  <div className={styles.gainersInfo}>
                    <span className={styles.gainersSymbol}>{c.symbol}</span>
                    <span className={styles.gainersPrice}>${c.price}</span>
                  </div>
                  <span className={styles.gainersChange}>+{c.change.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </aside>
        </section>

        {/* Markets — rounded card-list */}
        <section className={styles.section} id="markets">
          <h2 className={`${styles.sectionTitle} ${display.className}`}>Mercados populares</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Moneda</th>
                  <th className={styles.thNum}>Precio</th>
                  <th className={styles.thNum}>24 h</th>
                  <th className={styles.thNum}>7 d</th>
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
                        <img className={styles.coinIcon} src={iconUrl(c.symbol)} alt="" width={34} height={34} loading="lazy" />
                        <div>
                          <div className={styles.coinSymbol}>{c.symbol}</div>
                          <div className={styles.coinName}>{c.name}</div>
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
                  <AppQr value={REGION_NOTICE} fgColor="#1F1B2E" />
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
