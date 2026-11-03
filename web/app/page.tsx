import type { Metadata } from 'next';
import styles from './marketing.module.css';
import { HomeHero } from './_home/HomeHero';
import { LiveMarkets } from './_home/LiveMarkets';
import { HomeExtras } from './_home/HomeExtras';

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
    <div className={styles.page}>
      <main>
        {/* Hero — marketing (signed out) or portfolio dashboard (signed in) */}
        <HomeHero />

        {/* Markets */}
        <LiveMarkets />

        {/* Download · FAQ · Features (client, i18n-driven) */}
        <HomeExtras />
      </main>
    </div>
  );
}
