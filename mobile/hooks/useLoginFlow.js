import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';

/**
 * Hook personalizado para manejar el flujo completo de login en MOBILE
 * Versión simplificada sin react-query
 */
export const useLoginFlow = () => {
  const router = useRouter();
  const { login: loginContext } = useAuth();

  // Estado del flujo de autenticación
  const [requires2FA, setRequires2FA] = useState(false);
  const [temporalToken, setTemporalToken] = useState('');
  
  // Estados de carga
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Login con credenciales
  const loginWithCredentials = async ({ emailOrUsername, password }) => {
    setIsLoggingIn(true);
    try {
      const data = await authService.loginWithCredentials(emailOrUsername, password);
      
      if (data.requires2FA) {
        // Requiere verificación 2FA
        setRequires2FA(true);
        setTemporalToken(data.temporalToken);
        Alert.alert(
          'Verificación requerida',
          'Credenciales correctas. Revisa tu email para el código de verificación.',
          [{ text: 'OK' }]
        );
      } else {
        // Login exitoso sin 2FA
        await authService.setAuthToken(data.token);
        loginContext({
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
          role: data.user.rol || data.user.role,
          emailVerificado: data.user.emailVerificado || false,
          googleId: data.user.googleId || null,
        });
        Alert.alert('¡Bienvenido!', '', [{ text: 'OK' }]);
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('❌ Error en login:', error);
      Alert.alert(
        'Error de autenticación',
        error.response?.data?.error ||
          'Usuario o contraseña incorrectos. Por favor, inténtalo de nuevo.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Verificar código 2FA
  const verify2FA = async (codigo) => {
    setIsVerifying(true);
    try {
      const data = await authService.verify2FA(codigo, temporalToken);
      
      // Login exitoso con 2FA
      await authService.setAuthToken(data.token);
      loginContext({
        id: data.user.id,
        email: data.user.email,
        username: data.user.username,
        role: data.user.rol || data.user.role,
        emailVerificado: data.user.emailVerificado || false,
        googleId: data.user.googleId || null,
      });
      Alert.alert(
        '¡Verificación exitosa!',
        'Bienvenido a tu cuenta',
        [{ text: 'OK' }]
      );
      router.replace('/(tabs)');
    } catch (error) {
      console.error('❌ Error en verificación 2FA:', error);
      Alert.alert(
        'Código incorrecto',
        error.response?.data?.error ||
          'Código de verificación incorrecto. Por favor, inténtalo de nuevo.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsVerifying(false);
    }
  };

  // Reenviar código 2FA
  const resend2FA = async () => {
    setIsResending(true);
    try {
      await authService.resend2FA(temporalToken);
      Alert.alert(
        'Código reenviado',
        'Se ha enviado un nuevo código a tu email',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('❌ Error al reenviar código:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'Error al reenviar código. Intenta de nuevo.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsResending(false);
    }
  };

  // Resetear el flujo y volver al login inicial
  const resetToLogin = () => {
    setRequires2FA(false);
    setTemporalToken('');
  };

  return {
    // Estado
    requires2FA,

    // Acciones
    loginWithCredentials,
    verify2FA,
    resend2FA,
    resetToLogin,

    // Estados de carga
    isLoggingIn,
    isVerifying,
    isResending,
  };
};

export default useLoginFlow;