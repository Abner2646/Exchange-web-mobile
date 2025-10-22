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
  const { updateUser } = useAuth(); // ⭐ Obtener updateUser del context

  // Estado para el contador de reenvío
  const [canResend, setCanResend] = useState(true);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Mutation: Verificar código de email
  const verifyEmailMutation = useMutation(
    (codigo) => authService.verifyEmail(codigo),
    {
      onSuccess: () => {
        // ⭐ Actualizar el estado del user en el context
        updateUser({ emailVerificado: true });
        
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
        const errorMessage = 
          error.response?.data?.message || 
          error.response?.data?.error || 
          'Código de verificación incorrecto. Por favor, inténtalo de nuevo.';
        
        toast.error(errorMessage, {
          duration: 5000,
        });
      },
    }
  );

  // Mutation: Reenviar código de verificación
  const resendCodeMutation = useMutation(
    () => authService.resendVerificationEmail(),
    {
      onSuccess: () => {
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
        const errorMessage = 
          error.response?.data?.message || 
          error.response?.data?.error || 
          'Error al reenviar código. Intenta de nuevo.';
        
        toast.error(errorMessage);
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

    // Estados de carga
    isVerifying: verifyEmailMutation.isLoading,
    isResending: resendCodeMutation.isLoading,

    // Estado de reenvío
    canResend,
    resendCountdown,
  };
};

export default useEmailVerification;