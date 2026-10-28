'use client';

import { useTranslation } from '@/shared/i18n';
import SwapForm from './SwapForm';
import SwapHistory from './SwapHistory';
import styles from './swap.module.css';

export default function SwapWidget() {
  const { t } = useTranslation();
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('swap.page.title')}</h1>
        <p className={styles.subtitle}>{t('swap.page.subtitle')}</p>
      </header>
      <SwapForm />
      <SwapHistory />
    </div>
  );
}
