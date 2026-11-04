'use client';

import Link from 'next/link';
import { useTranslation } from '@/shared/i18n';
import styles from './Footer.module.css';

function Column({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div className={styles.section}>
      <h4 className={styles.sectionTitle}>{title}</h4>
      <ul className={styles.links}>
        {links.map((l) => (
          <li key={l.href}><Link href={l.href} className={styles.link}>{l.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  // Proper nouns (Trading Spot, Swap, P2P, Wallet, Blog) are brand names — not translated.
  const PRODUCT = [
    { label: 'Trading Spot', href: '/trading' },
    { label: 'Swap', href: '/swap' },
    { label: 'P2P', href: '/p2p' },
    { label: 'Wallet', href: '/wallet' },
  ];
  const RESOURCES = [
    { label: t('footer.link.help'), href: '/help' },
    { label: 'Blog', href: '/blog' },
    { label: t('footer.link.academy'), href: '/academy' },
    { label: t('footer.link.status'), href: '/status' },
  ];
  const LEGAL = [
    { label: t('footer.link.privacy'), href: '/privacy' },
    { label: t('footer.link.terms'), href: '/terms' },
    { label: t('footer.link.cookies'), href: '/cookies' },
    { label: t('footer.link.aml'), href: '/aml' },
  ];
  const COMPANY = [
    { label: t('footer.link.about'), href: '/about' },
    { label: t('footer.link.news'), href: '/news' },
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.grid}>
          <div className={styles.brand}>
            <div className={styles.logoRow}>
              <span className={styles.logo}>BitFlow</span>
              <span className={styles.badge}>Exchange</span>
            </div>
            <p className={styles.description}>{t('footer.tagline')}</p>
            <div className={styles.social}>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="Twitter">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={styles.socialIcon}><path d="M23.643 4.937c-.835.37-1.732.62-2.675.733.962-.576 1.7-1.49 2.048-2.578-.9.534-1.897.922-2.958 1.13-.85-.904-2.06-1.47-3.4-1.47-2.572 0-4.658 2.086-4.658 4.66 0 .364.042.718.12 1.06-3.873-.195-7.304-2.05-9.602-4.868-.4.69-.63 1.49-.63 2.342 0 1.616.823 3.043 2.072 3.878-.764-.025-1.482-.234-2.11-.583v.06c0 2.257 1.605 4.14 3.737 4.568-.392.106-.803.162-1.227.162-.3 0-.593-.028-.877-.082.593 1.85 2.313 3.198 4.352 3.234-1.595 1.25-3.604 1.995-5.786 1.995-.376 0-.747-.022-1.112-.065 2.062 1.323 4.51 2.093 7.14 2.093 8.57 0 13.255-7.098 13.255-13.254 0-.2-.005-.402-.014-.602.91-.658 1.7-1.477 2.323-2.41z" /></svg>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="LinkedIn">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={styles.socialIcon}><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9h3.564v11.452z" /></svg>
              </a>
              <a href="https://t.me" target="_blank" rel="noopener noreferrer" className={styles.socialLink} aria-label="Telegram">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={styles.socialIcon}><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.064-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
              </a>
            </div>
          </div>

          <Column title={t('footer.col.product')} links={PRODUCT} />
          <Column title={t('footer.col.resources')} links={RESOURCES} />
          <Column title={t('footer.col.legal')} links={LEGAL} />
          <Column title={t('footer.col.company')} links={COMPANY} />
        </div>

        <div className={styles.bottom}>
          <p className={styles.copyright}>{t('footer.copyright', { year })}</p>
          <a
            href="https://www.norvex.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.credit}
            aria-label="Developed by Norvex"
          >
            <span className={styles.creditText}>{t('footer.developedBy')}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/norvex.png" alt="Norvex" className={styles.creditLogo} width={88} height={24} />
          </a>
        </div>
      </div>
    </footer>
  );
}
