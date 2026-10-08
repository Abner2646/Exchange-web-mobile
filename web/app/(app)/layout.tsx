'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { session } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const authed = session.hasToken();

  useEffect(() => {
    if (!authed) router.replace('/login');
  }, [authed, router]);

  if (!authed) return null;
  return (
    <>
      <nav aria-label={t('nav.dashboard')}>
        <Link href="/dashboard">{t('nav.dashboard')}</Link>
        <Link href="/wallet">{t('nav.wallet')}</Link>
      </nav>
      {children}
    </>
  );
}
