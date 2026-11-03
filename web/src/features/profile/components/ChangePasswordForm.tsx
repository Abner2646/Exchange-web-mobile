'use client';

import { useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Input, useSuccessFlash } from '@/shared/ui';
import { useChangePassword } from '../queries';
import styles from './profile.module.css';

const MIN_PASSWORD_LENGTH = 8;

export function ChangePasswordForm() {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const { flash } = useSuccessFlash();
  const mutation = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const allFilled = currentPassword.length > 0 && newPassword.length > 0 && confirmNewPassword.length > 0;
  const isTooShort = newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const isMismatch = newPassword.length > 0 && confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;
  const isSameAsCurrent = newPassword.length > 0 && newPassword === currentPassword;
  const isValid = allFilled && !isTooShort && !isMismatch && !isSameAsCurrent;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    // Security: only currentPassword + newPassword go on the wire — confirm NEVER leaves the client.
    mutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          flash({ title: t('profile.password.success') });
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
        },
      },
    );
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.cardTitle}>{t('profile.password.heading')}</h2>

      <Field label={t('profile.password.current.label')}>
        <Input id="change-password-current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
      </Field>

      <Field label={t('profile.password.new.label')} helpText={isTooShort ? t('profile.password.weak') : undefined}>
        <Input id="change-password-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
      </Field>

      <Field label={t('profile.password.confirm.label')} helpText={isMismatch ? t('profile.password.mismatch') : undefined}>
        <Input id="change-password-confirm" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} autoComplete="new-password" />
      </Field>

      {mutation.isError && mutation.error != null && (
        <p role="alert" className={styles.alert}>
          {tError(mutation.error.code, { requestId: mutation.error.requestId ?? '' })}
        </p>
      )}

      {mutation.isSuccess && (
        <p role="status" className={styles.success}>{t('profile.password.success')}</p>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={!isValid || mutation.isPending} loading={mutation.isPending}>
          {t('profile.password.submit')}
        </Button>
      </div>
    </form>
  );
}
