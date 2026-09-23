import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRequestEmailChange, useConfirmEmailChange } from '../queries';
import { Field, Button } from '../../../shared/ui';
import { useTranslation } from '../../../shared/i18n';

interface RequestFormData {
  nuevoEmail: string;
  passwordActual: string;
}

interface ConfirmFormData {
  codigo: string;
}

export const EmailChangeForm: React.FC = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const { t } = useTranslation();
  
  const requestMutation = useRequestEmailChange();
  const confirmMutation = useConfirmEmailChange();

  const { register: registerRequest, handleSubmit: handleRequestSubmit, formState: { errors: requestErrors } } = useForm<RequestFormData>();
  const { register: registerConfirm, handleSubmit: handleConfirmSubmit, formState: { errors: confirmErrors } } = useForm<ConfirmFormData>();

  const onRequestSubmit = (data: RequestFormData) => {
    requestMutation.mutate(data, {
      onSuccess: () => {
        setStep(2);
      }
    });
  };

  const onConfirmSubmit = (data: ConfirmFormData) => {
    confirmMutation.mutate(data);
  };

  return (
    <div>
      <h2>Change Email</h2>
      
      {step === 1 && (
        <form onSubmit={handleRequestSubmit(onRequestSubmit)}>
          <p>Please enter your new email and current password.</p>
          
          {requestMutation.isError && (
            <div style={{ color: 'red' }}>
              {t((requestMutation.error as any).code || 'INTERNAL_ERROR')}
            </div>
          )}

          <Field label="New Email" error={requestErrors.nuevoEmail?.message}>
            <input type="email" id="nuevoEmail" {...registerRequest('nuevoEmail', { required: true })} />
          </Field>

          <Field label="Current Password" error={requestErrors.passwordActual?.message}>
            <input type="password" id="passwordActual" {...registerRequest('passwordActual', { required: true })} />
          </Field>
          
          <Button type="submit" disabled={requestMutation.isLoading}>
            {requestMutation.isLoading ? 'Requesting...' : 'Request Email Change'}
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleConfirmSubmit(onConfirmSubmit)}>
          <p>A code was sent to your new email. Please enter it below.</p>
          <div style={{ color: 'orange', fontWeight: 'bold' }}>
            WARNING: A successful email change starts a 24h withdrawal cooldown.
          </div>

          {confirmMutation.isError && (
            <div style={{ color: 'red' }}>
              {t((confirmMutation.error as any).code || 'INTERNAL_ERROR')}
            </div>
          )}

          {confirmMutation.isSuccess && (
            <div style={{ color: 'green' }}>Email changed successfully!</div>
          )}

          <Field label="Confirmation Code" error={confirmErrors.codigo?.message}>
            <input type="text" id="codigo" {...registerConfirm('codigo', { required: true })} />
          </Field>

          <Button type="submit" disabled={confirmMutation.isLoading || confirmMutation.isSuccess}>
            {confirmMutation.isLoading ? 'Confirming...' : 'Confirm Code'}
          </Button>
        </form>
      )}
    </div>
  );
};
