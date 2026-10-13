'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useChangePassword } from '../queries';
import styles from './profile.module.css';

const MIN_PASSWORD_LENGTH = 8;

export function ChangePasswordForm() {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const mutation = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // ── Client-side validation (advisory; server is authoritative) ────────────
  const allFilled = currentPassword.length > 0 && newPassword.length > 0 && confirmNewPassword.length > 0;
  const isTooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const isMismatch = newPassword.length > 0 && confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;
  const isSameAsCurrent = newPassword.length > 0 && newPassword === currentPassword;

  const isValid = allFilled && !isTooShort && !isMismatch && !isSameAsCurrent;

  // ── Success: clear all fields ─────────────────────────────────────────────
  // We track success to clear fields when isSuccess transitions to true.
  // Because mutation.isSuccess is set by the hook, we reset local state
  // using a controlled approach: when the form was submitted and succeeded
  // we clear the fields from the onSuccess callback.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    // Security: only send currentPassword + newPassword — confirmNewPassword NEVER leaves the client
    mutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
        },
      },
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* Current password */}
      <Field label={t('profile.password.current.label')}>
        <input
          id="change-password-current"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
        />
      </Field>

      {/* New password */}
      <Field
        label={t('profile.password.new.label')}
        helpText={isTooShort ? t('profile.password.weak') : undefined}
      >
        <input
          id="change-password-new"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>

      {/* Confirm new password */}
      <Field
        label={t('profile.password.confirm.label')}
        helpText={isMismatch ? t('profile.password.mismatch') : undefined}
      >
        <input
          id="change-password-confirm"
          type="password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>

      {/* Error */}
      {mutation.isError && mutation.error != null && (
        <p role="alert" className={styles.error}>
          {tError(mutation.error.code, { requestId: mutation.error.requestId ?? '' })}
        </p>
      )}

      {/* Success */}
      {mutation.isSuccess && (
        <p role="status" className={styles.success}>
          {t('profile.password.success')}
        </p>
      )}

      <div className={styles.actions}>
        <Button
          type="submit"
          disabled={!isValid || mutation.isPending}
          loading={mutation.isPending}
        >
          {t('profile.password.submit')}
        </Button>
      </div>
    </form>
  );
}
