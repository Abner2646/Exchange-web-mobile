'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Field, Button } from '@/shared/ui';
import { useTranslation, useErrorTranslation } from '@/shared/i18n';
import { isApiError } from '@/shared/api';
import { useLogin, useVerify2FA, useResend2FA } from '../queries';
import { isTwoFactorChallenge } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';
import styles from './authForm.module.css';

type Step =
  | { kind: 'credentials' }
  | { kind: 'twofa'; method: 'totp' | 'email'; temporalToken: string };

export const LoginForm: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const login = useLogin();
  const verify2fa = useVerify2FA();
  const resend2fa = useResend2FA();

  const [step, setStep] = useState<Step>({ kind: 'credentials' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const showError = (err: unknown) =>
    setError(isApiError(err) ? tError(err.code, { requestId: err.requestId ?? '' }) : tError('FALLBACK_UNKNOWN_ERROR'));

  const onCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const result = await login.mutateAsync({ email, password });
      if (isTwoFactorChallenge(result)) {
        setStep({ kind: 'twofa', method: result.twoFactorMethod, temporalToken: result.temporalToken });
        return;
      }
      router.replace('/dashboard');
    } catch (err) { showError(err); }
  };

  const onTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step.kind !== 'twofa') return;
    setError(null);
    try {
      await verify2fa.mutateAsync({ temporalToken: step.temporalToken, codigo });
      router.replace('/dashboard');
    } catch (err) { showError(err); }
  };

  const onResend = async () => {
    if (step.kind !== 'twofa') return;
    setError(null);
    try { await resend2fa.mutateAsync({ temporalToken: step.temporalToken }); }
    catch (err) { showError(err); }
  };

  if (step.kind === 'twofa') {
    return (
      <form className={styles.form} onSubmit={onTwoFactor} noValidate>
        <h1>{step.method === 'totp' ? t('auth.twofa.title.totp') : t('auth.twofa.title.email')}</h1>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Field label={t('auth.field.code')}>
          <input type="text" inputMode="numeric" autoComplete="one-time-code" required value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" loading={verify2fa.isPending}>{t('auth.twofa.submit')}</Button>
          {step.method === 'email' && (
            <Button type="button" variant="ghost" loading={resend2fa.isPending} onClick={onResend}>{t('auth.twofa.resend')}</Button>
          )}
        </div>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={onCredentials} noValidate>
      <h1>{t('auth.login.title')}</h1>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Field label={t('auth.field.email')}>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t('auth.field.password')}>
        <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" loading={login.isPending}>{t('auth.login.submit')}</Button>
      </div>
      <div className={styles.divider}>—</div>
      <GoogleSignInButton />
      <div className={styles.links}>
        <Link href="/forgot-password">{t('auth.login.forgot')}</Link>
        <Link href="/register">{t('auth.login.needAccount')}</Link>
      </div>
    </form>
  );
};
