import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation, useErrorTranslation } from '../../../shared/i18n';
import { Field, Button } from '../../../shared/ui';
import { useLogin } from '../queries';
import { isApiError } from '../../../shared/api';
import { LoginRequest } from '../api';

export const LoginForm: React.FC = () => {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const loginMutation = useLogin();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginRequest>();

  const onSubmit = handleSubmit((data) => {
    loginMutation.mutate(data);
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2>{t('auth.login.title')}</h2>
      
      {loginMutation.isError && isApiError(loginMutation.error) && (
        <div role="alert" style={{ color: 'red', marginBottom: '1rem' }}>
          {tError(loginMutation.error.code)}
        </div>
      )}

      {loginMutation.isSuccess && (
        <div role="status" style={{ color: 'green', marginBottom: '1rem' }}>
          {t('auth.login.success')}
        </div>
      )}

      <Field label={t('auth.login.email')} error={errors.email?.message}>
        <input type="email" {...register('email', { required: t('validation.required') })} />
      </Field>
      
      <Field label={t('auth.login.password')} error={errors.password?.message}>
        <input type="password" {...register('password', { required: t('validation.required') })} />
      </Field>
      
      <Button
        type="submit"
        loading={loginMutation.isLoading}
        disabled={loginMutation.isLoading || loginMutation.isSuccess}
      >
        {t('auth.login.submit')}
      </Button>

      {/* TODO: Google GIS login, 2FA, password recovery */}
    </form>
  );
};
