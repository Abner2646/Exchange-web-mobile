// mobile/hooks/useForgotPasswordFlow.js
import { useState } from 'react';
import { Alert } from 'react-native';
import authService from '../services/authService';

export const useForgotPasswordFlow = () => {
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [step, setStep] = useState(1);
  
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const requestCode = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Ingresa tu email');
      return;
    }

    setIsRequestingCode(true);
    try {
      await authService.requestPasswordReset(email.trim().toLowerCase());
      setStep(2);
      Alert.alert(
        'Código enviado',
        'Revisa tu email para obtener el código de recuperación.',
        [{ text: 'Entendido' }]
      );
    } catch (error) {
      console.error('Error solicitando código:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'No se pudo enviar el código. Verifica tu email.',
        [{ text: 'Entendido' }]
      );
    } finally {
      setIsRequestingCode(false);
    }
  };

  const resendCode = async () => {
    setIsResending(true);
    try {
      await authService.requestPasswordReset(email.trim().toLowerCase());
      Alert.alert(
        'Código reenviado',
        'Se ha enviado un nuevo código a tu email.',
        [{ text: 'Entendido' }]
      );
    } catch (error) {
      console.error('Error reenviando código:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'No se pudo reenviar el código.',
        [{ text: 'Entendido' }]
      );
    } finally {
      setIsResending(false);
    }
  };

  const resetPassword = async () => {
    if (codigo.length !== 6) {
      Alert.alert('Error', 'El código debe tener 6 dígitos');
      return;
    }

    // ✅ CORREGIDO: Trim antes de validar longitud
    const trimmedPassword = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedPassword || trimmedPassword.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    // ✅ CORREGIDO: Comparar con trim
    if (trimmedPassword !== trimmedConfirm) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    setIsResetting(true);
    try {
      await authService.resetPassword(
        email.trim().toLowerCase(),
        codigo,
        trimmedPassword // ✅ Enviar con trim
      );
      
      Alert.alert(
        'Contraseña actualizada',
        'Tu contraseña ha sido cambiada exitosamente. Ahora puedes iniciar sesión.',
        [{ text: 'Entendido' }]
      );
      
      return true;
    } catch (error) {
      console.error('Error reseteando contraseña:', error);
      Alert.alert(
        'Error',
        error.response?.data?.error || 'No se pudo cambiar la contraseña. Verifica el código.',
        [{ text: 'Entendido' }]
      );
      return false;
    } finally {
      setIsResetting(false);
    }
  };

  const resetFlow = () => {
    setEmail('');
    setCodigo('');
    setNewPassword('');
    setConfirmPassword('');
    setStep(1);
  };

  return {
    email,
    setEmail,
    codigo,
    setCodigo,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    step,
    requestCode,
    resendCode,
    resetPassword,
    resetFlow,
    isRequestingCode,
    isResending,
    isResetting,
  };
};

export default useForgotPasswordFlow;