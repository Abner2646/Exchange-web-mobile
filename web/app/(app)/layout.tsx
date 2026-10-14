'use client';

import { useEffect, useReducer } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { session } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useCurrentUser } from '@/features/auth/queries';
import { isAdminRole } from '@/features/admin/roles';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const { data: user } = useCurrentUser();

  useEffect(() => {
    // A 401 clears the token via session.notifyUnauthorized but nothing else
    // re-renders this guard — force one so the fresh hasToken() read below runs.
    const unsubscribe = session.onUnauthorized(() => forceRender());
    return () => { unsubscribe(); };
  }, []);

  // Read the token FRESH every render so the guard reflects BOTH a 401-clear
  // (forced above) and a manual logout (useLogout clears the token + nulls the
  // user cache, which re-renders this component through useCurrentUser).
  const authed = session.hasToken();

  // A user who has not verified their email must finish verification before using
  // the app (money-path guard). We only redirect once the user has loaded and is
  // explicitly unverified — while loading we render optimistically.
  const mustVerifyEmail = user != null && user.emailVerified === false;

  useEffect(() => {
    if (!authed) {
      router.replace('/login');
      return;
    }
    if (mustVerifyEmail) {
      router.replace('/verify-email');
    }
  }, [authed, mustVerifyEmail, router]);

  if (!authed || mustVerifyEmail) return null;
  return (
    <>
      <nav>
        <Link href="/dashboard">{t('nav.dashboard')}</Link>
        <Link href="/wallet">{t('nav.wallet')}</Link>
        <Link href="/swap">{t('nav.swap')}</Link>
        <Link href="/trading">{t('nav.trading')}</Link>
        <Link href="/p2p">{t('nav.p2p')}</Link>
        <Link href="/profile">{t('nav.profile')}</Link>
        {isAdminRole(user) && <Link href="/admin">{t('nav.admin')}</Link>}
      </nav>
      {children}
    </>
  );
}
