'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field, Button, Input } from '@/shared/ui';
import { MailIcon, InfoIcon } from '@/shared/ui/icons/Icon';
import { useTranslation, useErrorTranslation } from '@/shared/i18n';
import { isApiError } from '@/shared/api';
import { useVerifyEmail, useResendVerification } from '../queries';
import styles from './authForm.module.css';

const RESEND_COOLDOWN_SECONDS = 60;

export const VerifyEmailForm: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Tick the resend cooldown down to zero (V1 "Reenviar en Xs").
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (codigo.length !== 6) return;
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
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(isApiError(err) ? tError(err.code) : tError('FALLBACK_UNKNOWN_ERROR'));
    }
  };

  const resendLabel = cooldown > 0 ? t('auth.verifyEmail.resendIn', { s: cooldown }) : t('auth.verifyEmail.resend');

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <div className={styles.centerHead}>
        <span className={styles.iconBadge}><MailIcon size={28} /></span>
        <h1 className={styles.title}>{t('auth.verifyEmail.title')}</h1>
        <p className={styles.subtitle}>{t('auth.verifyEmail.description')}</p>
      </div>

      {notice && <p className={styles.notice} role="status">{notice}</p>}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <Field label={t('auth.verifyEmail.codeLabel')} helpText={t('auth.verifyEmail.hint')} required>
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={t('auth.verifyEmail.codePlaceholder')}
          maxLength={6}
          autoFocus
          required
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </Field>

      <div className={styles.actions}>
        <Button type="submit" loading={verify.isPending} disabled={codigo.length !== 6}>{t('auth.verifyEmail.submit')}</Button>
        <Button type="button" variant="ghost" loading={resend.isPending} disabled={cooldown > 0} onClick={onResend}>{resendLabel}</Button>
      </div>

      <p className={styles.spam}><InfoIcon size={16} />{t('auth.verifyEmail.spam')}</p>
    </form>
  );
};
