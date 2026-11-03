'use client';

import { useState } from 'react';
import { useTranslation, useLocale } from '@/shared/i18n';
import { useErrorTranslation } from '@/shared/i18n/errorCatalog';
import { Button, Field, Input, Select } from '@/shared/ui';
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

  if (!user) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(
      { displayName, country, state, locale },
      {
        onSuccess: () => {
          if (locale !== appLocale) setLocale(locale);
        },
      },
    );
  }

  const localeOptions = [
    { value: 'en', label: t('profile.account.localeEn') },
    { value: 'es', label: t('profile.account.localeEs') },
  ];

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <Field label={t('profile.account.username.label')}>
        <Input id="profile-username" type="text" value={user.username} disabled readOnly autoComplete="username" />
      </Field>
      <p className={styles.readOnlyNote}>{t('profile.account.username.readOnlyNote')}</p>

      <Field label={t('auth.field.email')}>
        <Input id="profile-email" type="email" value={user.email} disabled readOnly autoComplete="email" />
      </Field>

      <Field label={t('profile.account.displayName.label')} helpText={t('profile.account.displayName.helpText')}>
        <Input id="profile-displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
      </Field>

      <Field label={t('profile.account.country.label')}>
        <Input id="profile-country" type="text" value={country} onChange={(e) => setCountry(e.target.value)} autoComplete="country" />
      </Field>

      <Field label={t('profile.account.state.label')}>
        <Input id="profile-state" type="text" value={state} onChange={(e) => setState(e.target.value)} autoComplete="address-level1" />
      </Field>

      <div className={styles.fieldBlock}>
        <span className={styles.fieldLabel} id="profile-locale-label">{t('profile.account.locale.label')}</span>
        <Select
          options={localeOptions}
          value={locale}
          onChange={setLocaleField}
          aria-label={t('profile.account.locale.label')}
          aria-labelledby="profile-locale-label"
        />
      </div>

      {mutation.isError && mutation.error != null && (
        <p role="alert" className={styles.alert}>
          {tError(mutation.error.code, { requestId: mutation.error.requestId ?? '' })}
        </p>
      )}

      {mutation.isSuccess && (
        <p role="status" className={styles.success}>{t('profile.account.saved')}</p>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={mutation.isPending} loading={mutation.isPending}>
          {t('profile.account.save')}
        </Button>
      </div>
    </form>
  );
}
