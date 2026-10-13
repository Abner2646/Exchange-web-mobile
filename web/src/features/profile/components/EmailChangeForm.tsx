'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useRequestEmailChange, useConfirmEmailChange } from '../queries';
import styles from './profile.module.css';

type Step = 'request' | 'confirm' | 'done';

export function EmailChangeForm() {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const requestMutation = useRequestEmailChange();
  const confirmMutation = useConfirmEmailChange();

  // Two-step state — nuevoEmail and codigo live ONLY in React state,
  // NEVER in URL/localStorage/sessionStorage.
  const [step, setStep] = useState<Step>('request');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [passwordActual, setPasswordActual] = useState('');
  const [codigo, setCodigo] = useState('');

  // ── Step: request ──────────────────────────────────────────────────────────
  function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requestMutation.isPending) return;
    requestMutation.mutate(
      { nuevoEmail, passwordActual },
      {
        onSuccess: () => {
          // Clear password from memory; keep nuevoEmail only for display purposes (not persisted)
          setPasswordActual('');
          setStep('confirm');
        },
      },
    );
  }

  // ── Step: confirm ──────────────────────────────────────────────────────────
  function handleConfirmSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (confirmMutation.isPending) return;
    confirmMutation.mutate(
      { codigo },
      {
        onSuccess: () => {
          setCodigo('');
          setStep('done');
        },
      },
    );
  }

  // ── Step: done (success) ───────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className={styles.form}>
        <p role="status" className={styles.success}>
          {t('profile.emailChange.success')}
          {' '}
          {t('profile.emailChange.withdrawalCooldownWarning')}
        </p>
      </div>
    );
  }

  // ── Step: confirm ──────────────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <form className={styles.form} onSubmit={handleConfirmSubmit} noValidate>
        <Field label={t('profile.emailChange.code.label')}>
          <input
            id="email-change-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </Field>

        {/* Error */}
        {confirmMutation.isError && confirmMutation.error != null && (
          <p role="alert" className={styles.error}>
            {tError(confirmMutation.error.code, { requestId: confirmMutation.error.requestId ?? '' })}
          </p>
        )}

        <div className={styles.actions}>
          <Button
            type="submit"
            disabled={confirmMutation.isPending}
            loading={confirmMutation.isPending}
          >
            {t('profile.emailChange.confirmSubmit')}
          </Button>
        </div>
      </form>
    );
  }

  // ── Step: request (initial) ────────────────────────────────────────────────
  return (
    <form className={styles.form} onSubmit={handleRequestSubmit} noValidate>
      {/* Withdrawal-cooldown warning — shown BEFORE confirming */}
      <p className={styles.warning}>
        {t('profile.emailChange.withdrawalCooldownWarning')}
      </p>

      <Field label={t('profile.emailChange.newEmail.label')}>
        <input
          id="email-change-new-email"
          type="email"
          autoComplete="email"
          value={nuevoEmail}
          onChange={(e) => setNuevoEmail(e.target.value)}
        />
      </Field>

      <Field label={t('profile.emailChange.currentPassword.label')}>
        <input
          id="email-change-password"
          type="password"
          autoComplete="current-password"
          value={passwordActual}
          onChange={(e) => setPasswordActual(e.target.value)}
        />
      </Field>

      {/* Error */}
      {requestMutation.isError && requestMutation.error != null && (
        <p role="alert" className={styles.error}>
          {tError(requestMutation.error.code, { requestId: requestMutation.error.requestId ?? '' })}
        </p>
      )}

      <div className={styles.actions}>
        <Button
          type="submit"
          disabled={requestMutation.isPending}
          loading={requestMutation.isPending}
        >
          {t('profile.emailChange.requestSubmit')}
        </Button>
      </div>
    </form>
  );
}
