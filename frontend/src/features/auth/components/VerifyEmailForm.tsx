import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation, useErrorTranslation } from '../../../shared/i18n';
import { Field, Button } from '../../../shared/ui';
import { useVerifyEmail, useResendVerification } from '../queries';
import { isApiError } from '../../../shared/api';
import { VerifyEmailRequest } from '../api';

export const VerifyEmailForm: React.FC = () => {
  const { t } = useTranslation();
  const { tError } = useErrorTranslation();
  const verifyMutation = useVerifyEmail();
  const resendMutation = useResendVerification();

  const { register, handleSubmit, formState: { errors } } = useForm<VerifyEmailRequest>();

  const onSubmit = handleSubmit((data) => {
    verifyMutation.mutate(data);
  });

  const handleResend = () => {
    resendMutation.mutate();
  };

  return (
    <div>
      <form onSubmit={onSubmit} noValidate>
        <h2>{t('auth.verifyEmail.title')}</h2>
        
        {verifyMutation.isError && isApiError(verifyMutation.error) && (
          <div role="alert" style={{ color: 'red', marginBottom: '1rem' }}>
            {tError(verifyMutation.error.code)}
          </div>
        )}

        {verifyMutation.isSuccess && (
          <div role="status" style={{ color: 'green', marginBottom: '1rem' }}>
            {t('auth.verifyEmail.success')}
          </div>
        )}

        <Field label={t('auth.verifyEmail.code')} error={errors.code?.message}>
          <input type="text" {...register('code', { required: t('validation.required') })} />
        </Field>
        
        <Button
          type="submit"
          loading={verifyMutation.isLoading}
          disabled={verifyMutation.isLoading || verifyMutation.isSuccess}
        >
          {t('auth.verifyEmail.submit')}
        </Button>
      </form>

      <div style={{ marginTop: '2rem' }}>
        {resendMutation.isError && isApiError(resendMutation.error) && (
          <div role="alert" style={{ color: 'red', marginBottom: '1rem' }}>
            {tError(resendMutation.error.code)}
          </div>
        )}
        {resendMutation.isSuccess && (
          <div role="status" style={{ color: 'green', marginBottom: '1rem' }}>
            {t('auth.verifyEmail.resendSuccess')}
          </div>
        )}
        <Button
          variant="secondary"
          onClick={handleResend}
          loading={resendMutation.isLoading}
          disabled={resendMutation.isLoading || verifyMutation.isSuccess}
        >
          {t('auth.verifyEmail.resend')}
        </Button>
      </div>
    </div>
  );
};
