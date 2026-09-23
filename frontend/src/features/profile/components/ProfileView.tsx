import React from 'react';
import { useForm } from 'react-hook-form';
import { useProfile, useUpdateProfile } from '../queries';
import { Field, Button } from '../../../shared/ui';
import { useTranslation } from '../../../shared/i18n';

interface ProfileFormData {
  displayName: string;
  pais: string;
  estado: string;
  locale: string;
}

export const ProfileView: React.FC = () => {
  const { data: profile, isLoading, error } = useProfile();
  const updateMutation = useUpdateProfile();
  const { t } = useTranslation();
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormData>();

  React.useEffect(() => {
    if (profile) {
      reset({
        displayName: profile.displayName || '',
        pais: profile.pais || profile.country || '',
        estado: profile.estado || profile.state || '',
        locale: profile.locale || 'en',
      });
    }
  }, [profile, reset]);

  if (isLoading) return <div>Loading...</div>;
  
  if (error) {
    const apiError = error as { code?: string, message?: string };
    return <div>Error: {t(apiError.code || 'INTERNAL_ERROR')}</div>;
  }

  if (!profile) return <div>No profile data</div>;

  const onSubmit = (data: ProfileFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <div>
      <h2>Profile</h2>
      <div>
        <label>Username</label>
        <p>{profile.username}</p>
      </div>
      
      {updateMutation.isError && (
        <div style={{ color: 'red' }}>
          {t((updateMutation.error as any).code || 'INTERNAL_ERROR')}
        </div>
      )}
      
      {updateMutation.isSuccess && (
        <div style={{ color: 'green' }}>Profile updated successfully</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <Field label="Display Name" error={errors.displayName?.message}>
          <input id="displayName" {...register('displayName')} />
        </Field>
        
        <Field label="Country" error={errors.pais?.message}>
          <input id="pais" {...register('pais')} />
        </Field>
        
        <Field label="State" error={errors.estado?.message}>
          <input id="estado" {...register('estado')} />
        </Field>

        <Field label="Locale" error={errors.locale?.message}>
          <select id="locale" {...register('locale')}>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </Field>
        
        <Button type="submit" disabled={updateMutation.isLoading}>
          {updateMutation.isLoading ? 'Saving...' : 'Save'}
        </Button>
      </form>
    </div>
  );
};
