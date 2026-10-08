'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Button } from '@/shared/ui';
import { useTranslation, useErrorTranslation } from '@/shared/i18n';
import { isApiError } from '@/shared/api';
import { useVerifyEmail, useResendVerification } from '../queries';
import styles from './authForm.module.css';

export const VerifyEmailForm: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await verify.mutateAsync({ codigo });
      router.replace('/dashboard');
    } catch (err) {
      setError(isApiError(err) ? tError(err.code, { requestId: err.requestId ?? '' }) : tError('FALLBACK_UNKNOWN_ERROR'));
    }
  };

  const onResend = async () => {
    setError(null); setNotice(null);
    try {
      await resend.mutateAsync();
      setNotice(t('auth.verifyEmail.sent'));
    } catch (err) {
      setError(isApiError(err) ? tError(err.code) : tError('FALLBACK_UNKNOWN_ERROR'));
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <h1>{t('auth.verifyEmail.title')}</h1>
      <p>{t('auth.verifyEmail.sent')}</p>
      {notice && <p role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Field label={t('auth.field.code')}>
        <input type="text" inputMode="numeric" autoComplete="one-time-code" required value={codigo} onChange={(e) => setCodigo(e.target.value)} />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" loading={verify.isPending}>{t('auth.verifyEmail.submit')}</Button>
        <Button type="button" variant="ghost" loading={resend.isPending} onClick={onResend}>{t('auth.verifyEmail.resend')}</Button>
      </div>
    </form>
  );
};
