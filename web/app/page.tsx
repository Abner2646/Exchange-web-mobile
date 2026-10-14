import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './marketing.module.css';

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

const FEATURES: { title: string; body: string }[] = [
  {
    title: 'Custodial wallet',
    body: 'Funding and Spot compartments with available, blocked, and display-only pending balances. Self-service Funding↔Spot transfers; on-chain deposits and withdrawals.',
  },
  {
    title: 'Instant swap',
    body: 'Convert between assets against the house at an indicative quote with a transparent fee, daily-limit feedback, and an oracle-divergence safety pause.',
  },
  {
    title: 'Spot trading',
    body: 'A live order book with market and limit orders, maker/taker fees charged on the received asset, and an open-order lifecycle you can cancel.',
  },
  {
    title: 'P2P marketplace',
    body: 'Post and accept buy/sell offers with an escrow-style state machine — funds lock on accept and release on completion, with typed recovery at every step.',
  },
  {
    title: 'Security first',
    body: 'Email + TOTP two-factor, a withdrawal cooldown after sensitive changes, and Maker-Checker dual control on every privileged money movement.',
  },
  {
    title: 'Audit-grade controls',
    body: 'A double-entry ledger as the source of truth, a tamper-evident hash-chained audit trail, and continuous AML monitoring — built to a US FinCEN/NYDFS bar.',
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>BitFlow</span>
        <nav className={styles.headerNav} aria-label="Primary">
          <Link href="/login" className={styles.navLink}>Sign in</Link>
          <Link href="/register" className={styles.ctaSmall}>Get started</Link>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <h1 className={styles.title}>A custodial crypto exchange, built audit-grade.</h1>
          <p className={styles.subtitle}>
            Buy, swap, and trade crypto with the controls regulators expect — a double-entry ledger,
            a hash-chained audit trail, AML monitoring, and dual-control over every privileged action.
          </p>
          <div className={styles.actions}>
            <Link href="/register" className={styles.ctaPrimary}>Create an account</Link>
            <Link href="/login" className={styles.ctaSecondary}>Sign in</Link>
          </div>
        </section>

        <section className={styles.features} aria-label="What you can do">
          {FEATURES.map((f) => (
            <article key={f.title} className={styles.card}>
              <h2 className={styles.cardTitle}>{f.title}</h2>
              <p className={styles.cardBody}>{f.body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className={styles.footer}>
        {/* No build-time date: this page is statically prerendered, so new Date()
            would freeze to the build year. A plain mark avoids a stale year. */}
        <p>© BitFlow — custodial exchange. Mainnet assets held in custody.</p>
      </footer>
    </div>
  );
}
