import type { Metadata } from 'next';
import styles from './marketing.module.css';
import Faq from './_home/Faq';
import AppQr from './_home/AppQr';
import { HomeHero } from './_home/HomeHero';
import { LiveMarkets } from './_home/LiveMarkets';
import { FEATURE_ICONS } from './_home/icons';
import { FEATURES, REGION_NOTICE } from './_home/data';

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

export default function Home() {
  return (
    <div className={styles.page} data-theme="dark">
      <main>
        {/* Hero — marketing (signed out) or portfolio dashboard (signed in) */}
        <HomeHero />

        {/* Markets */}
        <LiveMarkets />

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
    </div>
  );
}
