// src/hooks/useEmailVerification.js
import { useState } from 'react';
import { useMutation } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

/**
 * Hook personalizado para manejar el flujo de verificación de email
 * El usuario ya está autenticado, solo necesita verificar su email
 */
export const useEmailVerification = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  // Estado para el contador de reenvío
  const [canResend, setCanResend] = useState(true);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // Mutation: Verificar código de email
  const verifyEmailMutation = useMutation(
    (codigo) => {
      setErrorMessage('');
      return authService.verifyEmail(codigo);
    },
    {
      onSuccess: (data) => {
        setErrorMessage('');
        // ⭐ GUARDAR EL NUEVO TOKEN (con emailVerificado: true)
        if (data.token) {
          authService.setAuthToken(data.token);
          console.log('✅ Nuevo token guardado después de verificar email');
        }
        
        // ⭐ Actualizar el estado del user en el context
        updateUser({ emailVerificado: true, emailVerified: true });
        
        toast.success('¡Email verificado exitosamente!', {
          duration: 4000,
          icon: '✅',
        });
        
        // Redirigir al home después de 1 segundo
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1000);
      },
      onError: (error) => {
        console.error('❌ Error en verificación de email:', error);
        const errData = error.response?.data;
        const msg = 
          (typeof errData?.error === 'string' ? errData.error : errData?.error?.message) ||
          errData?.message ||
          error.message ||
          'Código de verificación incorrecto. Por favor, inténtalo de nuevo.';
        
        setErrorMessage(msg);
        toast.error(msg, {
          duration: 5000,
        });
      },
    }
  );

  // Mutation: Reenviar código de verificación
  const resendCodeMutation = useMutation(
    () => {
      setErrorMessage('');
      return authService.resendVerificationEmail();
    },
    {
      onSuccess: () => {
        setErrorMessage('');
        toast.success('Nuevo código enviado a tu email', {
          duration: 4000,
          icon: '📧',
        });

        // Iniciar countdown de 60 segundos
        setCanResend(false);
        setResendCountdown(60);

        const interval = setInterval(() => {
          setResendCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              setCanResend(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      },
      onError: (error) => {
        console.error('❌ Error al reenviar código:', error);
        const errData = error.response?.data;
        const msg = 
          (typeof errData?.error === 'string' ? errData.error : errData?.error?.message) ||
          errData?.message ||
          'Error al reenviar código. Intenta de nuevo.';
        
        setErrorMessage(msg);
        toast.error(msg);
      },
    }
  );

  // Función para saltar la verificación
  const skipVerification = () => {
    toast('Puedes verificar tu email más tarde desde tu perfil', {
      duration: 4000,
      icon: 'ℹ️',
    });
    navigate('/', { replace: true });
  };

  return {
    // Acciones
    verifyEmail: verifyEmailMutation.mutate,
    resendCode: resendCodeMutation.mutate,
    skipVerification,

    // Estados de carga y error
    isVerifying: verifyEmailMutation.isLoading,
    isResending: resendCodeMutation.isLoading,
    errorMessage,
    clearError: () => setErrorMessage(''),

    // Estado de reenvío
    canResend,
    resendCountdown,
  };
};

export default useEmailVerification;