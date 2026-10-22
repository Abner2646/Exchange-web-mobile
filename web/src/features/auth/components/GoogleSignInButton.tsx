'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import { useErrorTranslation } from '@/shared/i18n';
import { isApiError } from '@/shared/api';
import { useGoogleLogin } from '../queries';
import styles from './authForm.module.css';

// Keeps the V2's secure idToken flow (server verifies the Google id_token). The
// official Google widget can't be fully custom-styled, so we keep it and just
// place it first with an "o" divider, matching the V1 layout. Hidden when no
// client id is configured (the idToken flow needs it).
export const GoogleSignInButton: React.FC = () => {
  const router = useRouter();
  const { tError } = useErrorTranslation();
  const googleLogin = useGoogleLogin();
  const [error, setError] = useState<string | null>(null);

  if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return null;

  const onSuccess = async (resp: { credential?: string }) => {
    setError(null);
    if (!resp.credential) { setError(tError('UNAUTHORIZED')); return; }
    try {
      await googleLogin.mutateAsync({ idToken: resp.credential });
      router.replace('/dashboard');
    } catch (err) {
      setError(isApiError(err) ? tError(err.code) : tError('FALLBACK_UNKNOWN_ERROR'));
    }
  };

  return (
    <>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.googleWrap}>
        <GoogleLogin onSuccess={onSuccess} onError={() => setError(tError('UNAUTHORIZED'))} width="340" />
      </div>
      <div className={styles.divider}><span>o</span></div>
    </>
  );
};
