'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { session } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { Spinner } from '@/shared/ui';

// Google OAuth callback landing. The backend redirects here with ?token=… after
// a successful sign-in (see backend auth.controller googleCallback). We persist
// the token and move on; useCurrentUser then hydrates the user from /user/me.
export default function AuthSuccessPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setFailed(true);
      const id = setTimeout(() => router.replace('/login'), 1500);
      return () => clearTimeout(id);
    }
    session.setToken(token);
    router.replace('/');
  }, [router]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      <Spinner size={32} label={t('auth.authSuccess.loading')} />
      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
        {failed ? t('auth.authSuccess.failed') : t('auth.authSuccess.loading')}
      </p>
    </div>
  );
}
