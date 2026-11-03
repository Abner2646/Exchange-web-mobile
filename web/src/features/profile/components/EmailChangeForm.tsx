'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Input, useSuccessFlash } from '@/shared/ui';
import { useRequestEmailChange, useConfirmEmailChange } from '../queries';
import styles from './profile.module.css';

type Step = 'request' | 'confirm' | 'done';

export function EmailChangeForm() {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const { flash } = useSuccessFlash();
  const requestMutation = useRequestEmailChange();
  const confirmMutation = useConfirmEmailChange();

  // Two-step state — nuevoEmail and codigo live ONLY in React state, never in URL/storage.
  const [step, setStep] = useState<Step>('request');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [passwordActual, setPasswordActual] = useState('');
  const [codigo, setCodigo] = useState('');

  function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requestMutation.isPending) return;
    requestMutation.mutate(
      { nuevoEmail, passwordActual },
      {
        onSuccess: () => {
          setPasswordActual('');
          setStep('confirm');
        },
      },
    );
  }

  function handleConfirmSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (confirmMutation.isPending) return;
    confirmMutation.mutate(
      { codigo },
      {
        onSuccess: () => {
          flash({ title: t('profile.emailChange.success') });
          setCodigo('');
          setStep('done');
        },
      },
    );
  }

  if (step === 'done') {
    return (
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>{t('profile.emailChange.heading')}</h2>
        <p role="status" className={styles.success}>
          {t('profile.emailChange.success')} {t('profile.emailChange.withdrawalCooldownWarning')}
        </p>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <form className={styles.card} onSubmit={handleConfirmSubmit} noValidate>
        <h2 className={styles.cardTitle}>{t('profile.emailChange.heading')}</h2>
        <Field label={t('profile.emailChange.code.label')}>
          <Input id="email-change-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </Field>

        {confirmMutation.isError && confirmMutation.error != null && (
          <p role="alert" className={styles.alert}>
            {tError(confirmMutation.error.code, { requestId: confirmMutation.error.requestId ?? '' })}
          </p>
        )}

        <div className={styles.actions}>
          <Button type="submit" disabled={confirmMutation.isPending} loading={confirmMutation.isPending}>
            {t('profile.emailChange.confirmSubmit')}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form className={styles.card} onSubmit={handleRequestSubmit} noValidate>
      <h2 className={styles.cardTitle}>{t('profile.emailChange.heading')}</h2>
      <p className={styles.warning}>{t('profile.emailChange.withdrawalCooldownWarning')}</p>

      <Field label={t('profile.emailChange.newEmail.label')}>
        <Input id="email-change-new-email" type="email" autoComplete="email" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} />
      </Field>

      <Field label={t('profile.emailChange.currentPassword.label')}>
        <Input id="email-change-password" type="password" autoComplete="current-password" value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} />
      </Field>

      {requestMutation.isError && requestMutation.error != null && (
        <p role="alert" className={styles.alert}>
          {tError(requestMutation.error.code, { requestId: requestMutation.error.requestId ?? '' })}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={requestMutation.isPending} loading={requestMutation.isPending}>
          {t('profile.emailChange.requestSubmit')}
        </Button>
      </div>
    </form>
  );
}
