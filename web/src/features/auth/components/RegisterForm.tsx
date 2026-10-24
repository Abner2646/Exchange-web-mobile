'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Field, Button, Input } from '@/shared/ui';
import { useTranslation, useErrorTranslation } from '@/shared/i18n';
import { isApiError } from '@/shared/api';
import { useRegister } from '../queries';
import { GoogleSignInButton } from './GoogleSignInButton';
import styles from './authForm.module.css';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = Partial<Record<'email' | 'username' | 'password' | 'confirmPassword', string>>;

export const RegisterForm: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const register = useRegister();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  // Per-field validation mirroring the V1 (validators.validateRegistrationForm).
  // confirmPassword is validated here and never sent — the backend contract is
  // { email, username, password }.
  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!email) errs.email = t('auth.register.err.emailRequired');
    else if (!EMAIL_REGEX.test(email)) errs.email = t('auth.register.err.emailInvalid');
    if (!username) errs.username = t('auth.register.err.usernameRequired');
    else if (username.length < 3) errs.username = t('auth.register.err.usernameMin');
    if (!password) errs.password = t('auth.register.err.passwordRequired');
    else if (password.length < 8) errs.password = t('auth.register.err.passwordMin');
    if (!confirmPassword) errs.confirmPassword = t('auth.register.err.confirmRequired');
    else if (password !== confirmPassword) errs.confirmPassword = t('auth.register.err.confirmMismatch');
    return errs;
  };

  // Clear a field's error as the user edits it (V1 handleChange behavior).
  const clearFieldError = (name: keyof FieldErrors) =>
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    try {
      await register.mutateAsync({ email, username, password });
      router.replace('/verify-email');
    } catch (err) {
      setError(isApiError(err) ? tError(err.code, { requestId: err.requestId ?? '' }) : tError('FALLBACK_UNKNOWN_ERROR'));
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div>
        <h1 className={styles.title}>{t('auth.register.title')}</h1>
        <p className={styles.description}>{t('auth.register.description')}</p>
      </div>

      <GoogleSignInButton labelKey="auth.google.register" />

      {error && <p className={styles.error} role="alert">{error}</p>}

      <Field label={t('auth.field.email')} required error={fieldErrors.email}>
        <Input
          type="email"
          autoComplete="email"
          placeholder={t('auth.field.emailPlaceholder')}
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
        />
      </Field>

      <Field label={t('auth.field.username')} required error={fieldErrors.username}>
        <Input
          type="text"
          autoComplete="username"
          placeholder={t('auth.field.usernamePlaceholder')}
          required
          value={username}
          onChange={(e) => { setUsername(e.target.value); clearFieldError('username'); }}
        />
      </Field>

      <Field label={t('auth.field.password')} required error={fieldErrors.password}>
        <Input
          type="password"
          autoComplete="new-password"
          placeholder={t('auth.field.passwordNewPlaceholder')}
          required
          value={password}
          onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
        />
      </Field>

      <Field label={t('auth.field.confirmPassword')} required error={fieldErrors.confirmPassword}>
        <Input
          type="password"
          autoComplete="new-password"
          placeholder={t('auth.field.confirmPasswordPlaceholder')}
          required
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
        />
      </Field>

      <div className={styles.actions}>
        <Button type="submit" loading={register.isPending}>{t('auth.register.submit')}</Button>
      </div>

      <p className={styles.termsMessage}>
        {t('auth.register.terms')}
        <a href="/terminos-y-condiciones">{t('auth.register.termsLink')}</a>
      </p>

      <p className={styles.footer}>
        <Link href="/login" className={styles.footerLink}>{t('auth.register.haveAccount')}</Link>
      </p>
    </form>
  );
};
