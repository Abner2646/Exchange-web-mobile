'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Field, Button, Input } from '@/shared/ui';
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
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const showError = (err: unknown) =>
    setError(isApiError(err) ? tError(err.code, { requestId: err.requestId ?? '' }) : tError('FALLBACK_UNKNOWN_ERROR'));

  const onCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      // Keep the V2 contract (sends `email`); the label stays "Email o usuario"
      // (V1 visual). NOTE: backend loginStep1 reads `emailOrUsername` — see the
      // reported possible bug; not changed here (tech stays as V2).
      const result = await login.mutateAsync({ email: emailOrUsername, password });
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

  const backToLogin = () => {
    setStep({ kind: 'credentials' });
    setCodigo(''); setError(null);
  };

  if (step.kind === 'twofa') {
    return (
      <form className={styles.form} onSubmit={onTwoFactor} noValidate>
        <h1 className={styles.title}>{step.method === 'totp' ? t('auth.twofa.title.totp') : t('auth.twofa.title.email')}</h1>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <Field label={t('auth.field.code')} required>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t('auth.field.codePlaceholder')}
            maxLength={6}
            autoFocus
            required
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </Field>
        <div className={styles.actions}>
          <Button type="submit" loading={verify2fa.isPending}>{t('auth.twofa.submit')}</Button>
        </div>
        {step.method === 'email' && (
          <div className={styles.resendRow}>
            <button type="button" className={styles.resendButton} disabled={resend2fa.isPending} onClick={onResend}>
              {t('auth.twofa.resend')}
            </button>
          </div>
        )}
        <button type="button" className={styles.backButton} onClick={backToLogin}>{t('auth.login.back')}</button>
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={onCredentials} noValidate>
      <div>
        <h1 className={styles.title}>{t('auth.login.title')}</h1>
        <p className={styles.description}>{t('auth.login.description')}</p>
      </div>

      <GoogleSignInButton />

      {error && <p className={styles.error} role="alert">{error}</p>}

      <Field label={t('auth.field.emailOrUsername')} required>
        <Input type="text" autoComplete="username" placeholder={t('auth.field.emailOrUsernamePlaceholder')} required value={emailOrUsername} onChange={(e) => setEmailOrUsername(e.target.value)} />
      </Field>
      <div>
        <Field label={t('auth.field.password')} required>
          <Input type="password" autoComplete="current-password" placeholder={t('auth.field.passwordPlaceholder')} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className={styles.forgotRow}>
          <Link href="/forgot-password" className={styles.inlineLink}>{t('auth.login.forgot')}</Link>
        </div>
      </div>

      <div className={styles.actions}>
        <Button type="submit" loading={login.isPending}>{t('auth.login.submit')}</Button>
      </div>

      <p className={styles.footer}>
        <Link href="/register" className={styles.footerLink}>{t('auth.login.needAccount')}</Link>
      </p>
    </form>
  );
};
