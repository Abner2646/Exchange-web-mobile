'use client';

import { useTranslation } from '@/shared/i18n';
import styles from '../marketing.module.css';
import Faq from './Faq';
import AppQr from './AppQr';
import { FEATURE_ICONS } from './icons';

/** Client-rendered marketing sections below the hero (download · FAQ · features).
 *  Split out of the server page.tsx so they can use the i18n catalog like the
 *  rest of the app (the app is Spanish-first and adapts to the browser locale). */
export function HomeExtras() {
  const { t } = useTranslation();

  return (
    <>
      {/* Download */}
      <section className={styles.download}>
        <div className={styles.downloadInner}>
          <div className={styles.downloadContent}>
            <h2 className={styles.downloadTitle}>{t('home.download.title')}</h2>
            <p className={styles.downloadSubtitle}>{t('home.download.subtitle')}</p>

            <div className={styles.qrRow}>
              <div className={styles.qrBox}>
                <AppQr value={t('home.regionNotice')} />
              </div>
              <div>
                <p className={styles.notAvailable}>{t('home.download.notAvailable')}</p>
                <p className={styles.qrHint}>{t('home.download.qrHint')}</p>
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
        <h2 className={styles.sectionTitle}>{t('home.faqTitle')}</h2>
        <Faq />
      </section>

      {/* Why us */}
      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>{t('home.featuresTitle')}</h2>
        <div className={styles.featuresGrid}>
          {[0, 1, 2, 3].map((i) => (
            <article key={i} className={styles.featureCard}>
              <div className={styles.featureIcon}>{FEATURE_ICONS[i]}</div>
              <h3>{t(`home.feature${i + 1}.title`)}</h3>
              <p>{t(`home.feature${i + 1}.body`)}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
