'use client';

import { useState } from 'react';
import { useTranslation, useLocale } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field } from '@/shared/ui';
import { useCurrentUser } from '@/features/auth/queries';
import { useUpdateProfile } from '../queries';
import styles from './profile.module.css';

export function ProfileForm() {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const { locale: appLocale, setLocale } = useLocale();
  const { data: user } = useCurrentUser();
  const mutation = useUpdateProfile();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [country, setCountry] = useState(user?.country ?? '');
  const [state, setState] = useState(user?.state ?? '');
  const [locale, setLocaleField] = useState(user?.locale ?? appLocale);

  // Guard: user not yet loaded
  if (!user) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(
      { displayName, country, state, locale },
      {
        onSuccess: () => {
          if (locale !== appLocale) {
            setLocale(locale);
          }
        },
      },
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* Username — read-only */}
      <Field label={t('profile.account.username.label')}>
        <input
          id="profile-username"
          type="text"
          value={user.username}
          disabled
          readOnly
          autoComplete="username"
        />
      </Field>
      <p className={styles.readOnlyNote}>{t('profile.account.username.readOnlyNote')}</p>

      {/* Email — read-only (changes on Security tab) */}
      <Field label={t('auth.field.email')}>
        <input
          id="profile-email"
          type="email"
          value={user.email}
          disabled
          readOnly
          autoComplete="email"
        />
      </Field>

      {/* Display name */}
      <Field
        label={t('profile.account.displayName.label')}
        helpText={t('profile.account.displayName.helpText')}
      >
        <input
          id="profile-displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="name"
        />
      </Field>

      {/* Country */}
      <Field label={t('profile.account.country.label')}>
        <input
          id="profile-country"
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          autoComplete="country"
        />
      </Field>

      {/* State / Province */}
      <Field label={t('profile.account.state.label')}>
        <input
          id="profile-state"
          type="text"
          value={state}
          onChange={(e) => setState(e.target.value)}
          autoComplete="address-level1"
        />
      </Field>

      {/* Locale — select over supported locales */}
      <Field label={t('profile.account.locale.label')}>
        <select
          id="profile-locale"
          value={locale}
          onChange={(e) => setLocaleField(e.target.value)}
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
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
          {t('profile.account.saved')}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={mutation.isPending} loading={mutation.isPending}>
          {t('profile.account.save')}
        </Button>
      </div>
    </form>
  );
}
