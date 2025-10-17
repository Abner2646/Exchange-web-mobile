// src/hooks/useProfile.js
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import authService from '../services/authService';
import { validatePasswordChange } from '../utils/validators';

export const useProfile = () => {
  const queryClient = useQueryClient();

  // Query para obtener perfil del usuario
  const {
    data: profile,
    isLoading,
    error,
    refetch: refetchProfile,
  } = useQuery('userProfile', () => authService.getProfile(), {
    staleTime: 60000, // 1 minuto
    onSuccess: (data) => {
      console.log('[useProfile] Perfil cargado:', data);
    },
    onError: (error) => {
      console.error('[useProfile] Error al cargar perfil:', error);
      toast.error('Error al cargar el perfil');
    },
  });

  // Mutation para cambiar contraseña
  const changePasswordMutation = useMutation(
    ({ currentPassword, newPassword }) =>
      authService.changePassword(currentPassword, newPassword),
    {
      onSuccess: () => {
        console.log('[useProfile] Contraseña cambiada exitosamente');
        toast.success('Contraseña cambiada exitosamente');
      },
      onError: (error) => {
        console.error('[useProfile] Error al cambiar contraseña:', error);
        const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Error al cambiar contraseña';
        toast.error(errorMessage);
      },
    }
  );

  // Mutation para toggle 2FA
  const toggle2FAMutation = useMutation(() => authService.toggle2FA(), {
    onSuccess: (data) => {
      console.log('[useProfile] 2FA toggled:', data);
      
      // Actualizar el cache del perfil con el nuevo estado de 2FA
      queryClient.setQueryData('userProfile', (oldData) => ({
        ...oldData,
        is2FAEnabled: data.is2FAEnabled,
      }));

      const message = data.is2FAEnabled
        ? 'Autenticación de dos factores activada'
        : 'Autenticación de dos factores desactivada';
      
      toast.success(message);
    },
    onError: (error) => {
      console.error('[useProfile] Error al cambiar configuración 2FA:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Error al cambiar configuración 2FA';
      toast.error(errorMessage);
    },
  });

  // Helper para cambiar contraseña con validación
  const changePassword = (passwordForm) => {
    console.log('[useProfile] Validando formulario de contraseña');
    
    // Validar formulario
    const validation = validatePasswordChange(passwordForm);
    
    if (!validation.isValid) {
      console.log('[useProfile] Validación fallida:', validation.errors);
      
      // Mostrar primer error
      const firstError = Object.values(validation.errors)[0];
      toast.error(firstError);
      return;
    }

    // Si pasa la validación, ejecutar mutation
    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  return {
    // Data
    profile,
    isLoading,
    error,

    // Actions
    changePassword,
    toggle2FA: toggle2FAMutation.mutate,
    refetchProfile,

    // Loading states
    isChangingPassword: changePasswordMutation.isLoading,
    isToggling2FA: toggle2FAMutation.isLoading,

    // Success states
    passwordChanged: changePasswordMutation.isSuccess,
  };
};

export default useProfile;