'use client';

import { useTranslation } from '@/shared/i18n';
import SwapForm from './SwapForm';
import SwapHistory from './SwapHistory';

export default function SwapWidget() {
  const { t } = useTranslation();
  return (
    <section>
      <h1>{t('swap.title')}</h1>
      <SwapForm />
      <SwapHistory />
    </section>
  );
}
