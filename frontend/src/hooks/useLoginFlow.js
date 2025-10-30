// src/hooks/useLoginFlow.js - CORREGIDO PARA 2FA 
import { useState } from 'react';
import { useMutation } from 'react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

/**
 * Hook personalizado para manejar el flujo completo de login
 * Incluye: login con credenciales, verificación 2FA, y reenvío de código
 */
export const useLoginFlow = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login: loginContext } = useAuth();

  // Obtener la ruta de destino (si existe)
  const from = location.state?.from?.pathname || '/';

  // Estado del flujo de autenticación
  const [requires2FA, setRequires2FA] = useState(false);
  const [temporalToken, setTemporalToken] = useState(''); // ✅ CORREGIDO: era preAuthToken

  // Mutation: Login con credenciales
  const loginMutation = useMutation(
    ({ emailOrUsername, password }) =>
      authService.loginWithCredentials(emailOrUsername, password),
    {
      onSuccess: (data) => {
        if (data.requires2FA) {
          // Requiere verificación 2FA
          setRequires2FA(true);
          setTemporalToken(data.temporalToken); // ✅ CORREGIDO: era data.preAuthToken
          toast.success('Credenciales correctas. Revisa tu email para el código de verificación.', {
            duration: 5000,
          });
        } else {
          // Login exitoso sin 2FA
          authService.setAuthToken(data.token);
          loginContext({
            id: data.user.id,
            email: data.user.email,
            username: data.user.username,
            role: data.user.rol || data.user.role,
            emailVerificado: data.user.emailVerificado || false,
            googleId: data.user.googleId || null,
          });
          toast.success('¡Bienvenido!');
          navigate(from, { replace: true });
        }
      },
      onError: (error) => {
        console.error('❌ Error en login:', error);
        toast.error(
          error.response?.data?.error ||
            'Usuario o contraseña incorrectos. Por favor, inténtalo de nuevo.'
        );
      },
    }
  );

  // Mutation: Verificar código 2FA
  const verify2FAMutation = useMutation(
    (codigo) => authService.verify2FA(codigo, temporalToken), // ✅ CORREGIDO: era preAuthToken
    {
      onSuccess: (data) => {
        // Login exitoso con 2FA
        authService.setAuthToken(data.token);
        loginContext({
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
          role: data.user.rol || data.user.role,
          emailVerificado: data.user.emailVerificado || false,
          googleId: data.user.googleId || null,
        });
        toast.success('¡Verificación exitosa! Bienvenido.');
        navigate(from, { replace: true });
      },
      onError: (error) => {
        console.error('❌ Error en verificación 2FA:', error);
        toast.error(
          error.response?.data?.error ||
            'Código de verificación incorrecto. Por favor, inténtalo de nuevo.'
        );
      },
    }
  );

  // Mutation: Reenviar código 2FA
  const resend2FAMutation = useMutation(
    () => authService.resend2FA(temporalToken), // ✅ CORREGIDO: era preAuthToken
    {
      onSuccess: () => {
        toast.success('Nuevo código enviado a tu email', {
          duration: 4000,
        });
      },
      onError: (error) => {
        console.error('❌ Error al reenviar código:', error);
        toast.error(
          error.response?.data?.error || 'Error al reenviar código. Intenta de nuevo.'
        );
      },
    }
  );

  // Función para resetear el flujo y volver al login inicial
  const resetToLogin = () => {
    setRequires2FA(false);
    setTemporalToken(''); // ✅ CORREGIDO: era preAuthToken
  };

  return {
    // Estado
    requires2FA,

    // Acciones
    loginWithCredentials: loginMutation.mutate,
    verify2FA: verify2FAMutation.mutate,
    resend2FA: resend2FAMutation.mutate,
    resetToLogin,

    // Estados de carga
    isLoggingIn: loginMutation.isLoading,
    isVerifying: verify2FAMutation.isLoading,
    isResending: resend2FAMutation.isLoading,
  };
};

export default useLoginFlow;