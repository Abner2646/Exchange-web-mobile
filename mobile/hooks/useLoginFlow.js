// mobile/hooks/useLoginFlow.js
import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';

export const useLoginFlow = () => {
  const router = useRouter();
  const { login: loginContext } = useAuth();

  const [requires2FA, setRequires2FA] = useState(false);
  const [temporalToken, setTemporalToken] = useState('');
  
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const loginWithCredentials = async ({ emailOrUsername, password }) => {
    setIsLoggingIn(true);
    try {
      const data = await authService.loginWithCredentials(emailOrUsername, password);
      
      if (data.requires2FA) {
        setRequires2FA(true);
        setTemporalToken(data.temporalToken);
        Alert.alert(
          'Verificación requerida',
          'Hemos enviado un código de verificación a tu email.',
          [{ text: 'Entendido' }]
        );
      } else {
        await authService.setAuthToken(data.token);
        loginContext({
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
          role: data.user.rol || data.user.role,
          emailVerificado: data.user.emailVerificado || false,
          googleId: data.user.googleId || null,
        });
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Error en login:', error);
      Alert.alert(
        'Error de autenticación',
        error.response?.data?.error || 'Credenciales incorrectas. Por favor, verifica tus datos.',
        [{ text: 'Entendido' }]
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  const verify2FA = async (codigo) => {
    if (!codigo || codigo.length !== 6) {
      Alert.alert('Error', 'El código debe tener 6 dígitos');
      return;
    }

    setIsVerifying(true);
    try {
      const data = await authService.verify2FA(codigo, temporalToken);
      
      await authService.setAuthToken(data.token);
      loginContext({
        id: data.user.id,
        email: data.user.email,
        username: data.user.username,
        role: data.user.rol || data.user.role,
        emailVerificado: data.user.emailVerificado || false,
        googleId: data.user.googleId || null,
      });
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error en verificación 2FA:', error);
      Alert.alert(
        'Código incorrecto',
        error.response?.data?.error || 'El código ingresado no es válido. Verifica e intenta nuevamente.',
        [{ text: 'Entendido' }]
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const resend2FA = async () => {
    setIsResending(true);
    try {
      await authService.resend2FA(temporalToken);
      Alert.alert(
        'Código reenviado',
        'Hemos enviado un nuevo código a tu email.',
        [{ text: 'Entendido' }]
      );
    } catch (error) {
      console.error('Error al reenviar código:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'No se pudo reenviar el código. Intenta nuevamente.',
        [{ text: 'Entendido' }]
      );
    } finally {
      setIsResending(false);
    }
  };

  const resetToLogin = () => {
    setRequires2FA(false);
    setTemporalToken('');
  };

  return {
    requires2FA,
    loginWithCredentials,
    verify2FA,
    resend2FA,
    resetToLogin,
    isLoggingIn,
    isVerifying,
    isResending,
  };
};

export default useLoginFlow;