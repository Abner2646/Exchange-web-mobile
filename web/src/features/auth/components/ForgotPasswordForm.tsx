'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Field, Button } from '@/shared/ui';
import { useTranslation, useErrorTranslation } from '@/shared/i18n';
import { isApiError } from '@/shared/api';
import { useForgotPassword, useVerifyResetCode, useResetPassword } from '../queries';
import styles from './authForm.module.css';

type Step = 'request' | 'code' | 'reset';

export const ForgotPasswordForm: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const forgot = useForgotPassword();
  const verifyCode = useVerifyResetCode();
  const reset = useResetPassword();

  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const showError = (err: unknown) =>
    setError(isApiError(err) ? tError(err.code, { requestId: err.requestId ?? '' }) : tError('FALLBACK_UNKNOWN_ERROR'));

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await forgot.mutateAsync({ email });
      setNotice(t('auth.forgot.sent'));
      setStep('code');
    } catch (err) { showError(err); }
  };

  const onCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await verifyCode.mutateAsync({ email, codigo });
      setStep('reset');
    } catch (err) { showError(err); }
  };

  const onReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) { setError(t('auth.reset.mismatch')); return; }
    try {
      await reset.mutateAsync({ email, codigo, newPassword, confirmPassword });
      router.replace('/dashboard');
    } catch (err) { showError(err); }
  };

  if (step === 'code') {
    return (
      <form className={styles.form} onSubmit={onCode} noValidate>
        <h1>{t('auth.reset.codeTitle')}</h1>
        {notice && <p role="status">{notice}</p>}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Field label={t('auth.field.code')}>
          <input type="text" inputMode="numeric" autoComplete="one-time-code" required value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" loading={verifyCode.isPending}>{t('auth.reset.codeSubmit')}</Button>
        </div>
      </form>
    );
  }

  if (step === 'reset') {
    return (
      <form className={styles.form} onSubmit={onReset} noValidate>
        <h1>{t('auth.reset.title')}</h1>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Field label={t('auth.field.newPassword')}>
          <input type="password" autoComplete="new-password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
        <Field label={t('auth.field.confirmPassword')}>
          <input type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" loading={reset.isPending}>{t('auth.reset.submit')}</Button>
        </div>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={onRequest} noValidate>
      <h1>{t('auth.forgot.title')}</h1>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Field label={t('auth.field.email')}>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" loading={forgot.isPending}>{t('auth.forgot.submit')}</Button>
      </div>
      <div className={styles.links}>
        <Link href="/login">{t('auth.login.title')}</Link>
      </div>
    </form>
  );
};
