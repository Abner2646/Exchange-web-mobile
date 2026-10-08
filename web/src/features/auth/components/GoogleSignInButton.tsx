'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import { useErrorTranslation } from '@/shared/i18n';
import { isApiError } from '@/shared/api';
import { useGoogleLogin } from '../queries';
import styles from './authForm.module.css';

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
    <div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <GoogleLogin onSuccess={onSuccess} onError={() => setError(tError('UNAUTHORIZED'))} />
    </div>
  );
};
