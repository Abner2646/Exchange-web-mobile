import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './marketing.module.css';
import Faq from './_home/Faq';
import AppQr from './_home/AppQr';
import { FEATURE_ICONS } from './_home/icons';
import { MARKET, GAINERS, FEATURES, REGION_NOTICE, iconUrl } from './_home/data';

export const metadata: Metadata = {
  title: 'BitFlow — Custodial crypto exchange',
  description:
    'Buy, swap, and trade crypto on BitFlow — a custodial exchange with audit-grade controls: double-entry ledger, hash-chained audit trail, AML monitoring, and Maker-Checker dual control.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'BitFlow — Custodial crypto exchange',
    description: 'Buy, swap, and trade crypto on BitFlow — audit-grade custodial exchange.',
    url: 'https://bitflow.community/',
    siteName: 'BitFlow',
    type: 'website',
  },
};

function Pct({ v }: { v: number }) {
  const cls = v > 0 ? styles.positive : v < 0 ? styles.negative : styles.neutral;
  return <span className={cls}>{v > 0 ? '+' : ''}{v.toFixed(2)}%</span>;
}

export default function Home() {
  return (
    <div className={styles.page} data-theme="dark">
      <header className={styles.header}>
        <span className={styles.brand}><span className={styles.brandDot} />BitFlow</span>
        <nav className={styles.headerNav} aria-label="Primary">
          <Link href="/login" className={styles.navLink}>Iniciar sesión</Link>
          <Link href="/register" className={styles.ctaSmall}>Crear cuenta</Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className={styles.hero}>
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

          <aside className={styles.gainersSection}>
            <div className={styles.gainersCard}>
              <div className={styles.gainersHeader}>
                <svg className={styles.gainersIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5l7 8h-4v6h-6v-6H5l7-8z" /></svg>
                <h3>Top Ganadores (24hs)</h3>
              </div>
              <div className={styles.gainersList}>
                {GAINERS.map((c) => (
                  <div key={c.symbol} className={styles.gainersItem}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={styles.coinIcon} src={iconUrl(c.symbol)} alt="" width={28} height={28} loading="lazy" />
                    <div className={styles.gainersInfo}>
                      <span className={styles.gainersSymbol}>{c.symbol}</span>
                      <span className={styles.gainersPrice}>${c.price}</span>
                    </div>
                    <span className={styles.gainersChange}>+{c.change.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        {/* Markets */}
        <section className={styles.section} id="markets">
          <h2 className={styles.sectionTitle}>Mercados Populares</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Moneda</th>
                  <th className={styles.thCenter}>Precio</th>
                  <th className={styles.thCenter}>24h %</th>
                  <th className={styles.thCenter}>7d %</th>
                  <th className={styles.thHideSm} style={{ textAlign: 'right' }}>Volumen 24h</th>
                  <th className={styles.thHideSm} style={{ textAlign: 'right' }}>Cap. de mercado</th>
                </tr>
              </thead>
              <tbody>
                {MARKET.map((c) => (
                  <tr key={c.symbol} className={styles.row}>
                    <td className={styles.coinCell}>
                      <div className={styles.coinInfo}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className={styles.coinIcon} src={iconUrl(c.symbol)} alt="" width={30} height={30} loading="lazy" />
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
          <div className={styles.marketsMore}>
            <Link href="/trading" className={styles.marketsMoreLink}>Ver todos los mercados →</Link>
          </div>
        </section>

        {/* Download */}
        <section className={styles.download}>
          <div className={styles.downloadInner}>
            <div className={styles.downloadContent}>
              <h2 className={styles.downloadTitle}>Opera desde cualquier lugar.</h2>
              <p className={styles.downloadSubtitle}>Tu exchange favorito, en tu bolsillo.</p>

              <div className={styles.qrRow}>
                <div className={styles.qrBox}>
                  <AppQr value={REGION_NOTICE} />
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
          <h2 className={styles.sectionTitle}>Preguntas Frecuentes</h2>
          <Faq />
        </section>

        {/* Why us */}
        <section className={styles.features}>
          <h2 className={styles.sectionTitle}>¿Por qué elegirnos?</h2>
          <div className={styles.featuresGrid}>
            {FEATURES.map((f, i) => (
              <article key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{FEATURE_ICONS[i]}</div>
                <h3>{f.title}</h3>
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
