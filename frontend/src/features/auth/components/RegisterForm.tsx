import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation, useErrorTranslation } from '../../../shared/i18n';
import { Field, Button } from '../../../shared/ui';
import { useRegister } from '../queries';
import { isApiError } from '../../../shared/api';
import { RegisterRequest } from '../api';

export const RegisterForm: React.FC = () => {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const registerMutation = useRegister();

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterRequest>();

  const onSubmit = handleSubmit((data) => {
    registerMutation.mutate(data);
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <h2>{t('auth.register.title')}</h2>
      
      {registerMutation.isError && isApiError(registerMutation.error) && (
        <div role="alert" style={{ color: 'red', marginBottom: '1rem' }}>
          {tError(registerMutation.error.code)}
        </div>
      )}
      
      {registerMutation.isSuccess && (
        <div role="status" style={{ color: 'green', marginBottom: '1rem' }}>
          {t('auth.register.success')}
        </div>
      )}

      <Field label={t('auth.register.username')} error={errors.username?.message}>
        <input type="text" {...register('username', { required: t('validation.required') })} />
      </Field>
      
      <Field label={t('auth.register.email')} error={errors.email?.message}>
        <input type="email" {...register('email', { required: t('validation.required') })} />
      </Field>
      
      <Field label={t('auth.register.password')} error={errors.password?.message}>
        <input type="password" {...register('password', { required: t('validation.required') })} />
      </Field>
      
      <Button
        type="submit"
        loading={registerMutation.isLoading}
        disabled={registerMutation.isLoading || registerMutation.isSuccess}
      >
        {t('auth.register.submit')}
      </Button>
    </form>
  );
};
