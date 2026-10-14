'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { session } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { useCurrentUser } from '@/features/auth/queries';
import { isAdminRole } from '@/features/admin/roles';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation();
  // `authed` is state (not a bare read) so the guard re-renders when the transport
  // clears the token on a 401 anywhere in the app (reactive sign-out).
  const [authed, setAuthed] = useState<boolean>(() => session.hasToken());
  const { data: user } = useCurrentUser();

  useEffect(() => {
    const unsubscribe = session.onUnauthorized(() => setAuthed(false));
    return () => { unsubscribe(); };
  }, []);

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
