'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Field, Button } from '@/shared/ui';
import { useTranslation, useErrorTranslation } from '@/shared/i18n';
import { isApiError } from '@/shared/api';
import { useRegister } from '../queries';
import styles from './authForm.module.css';

export const RegisterForm: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const register = useRegister();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register.mutateAsync({ email, username, password });
      router.replace('/verify-email');
    } catch (err) {
      setError(isApiError(err) ? tError(err.code, { requestId: err.requestId ?? '' }) : tError('FALLBACK_UNKNOWN_ERROR'));
    }
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <h1>{t('auth.register.title')}</h1>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <Field label={t('auth.field.email')}>
        <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label={t('auth.field.username')}>
        <input type="text" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
      </Field>
      <Field label={t('auth.field.password')}>
        <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <div className={styles.actions}>
        <Button type="submit" loading={register.isPending}>{t('auth.register.submit')}</Button>
      </div>
      <div className={styles.links}>
        <Link href="/login">{t('auth.register.haveAccount')}</Link>
      </div>
    </form>
  );
};
