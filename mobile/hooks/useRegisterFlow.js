// mobile/hooks/useRegisterFlow.js
import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const useRegisterFlow = () => {
  const router = useRouter();
  const { login: loginContext } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const [validationErrors, setValidationErrors] = useState({});
  const [isRegistering, setIsRegistering] = useState(false);

  const validateForm = () => {
    const errors = {};

    if (!formData.email.trim()) {
      errors.email = 'El email es requerido';
    } else if (!validateEmail(formData.email.trim())) {
      errors.email = 'Email inválido';
    }

    if (!formData.username.trim()) {
      errors.username = 'El usuario es requerido';
    } else if (formData.username.trim().length < 3) {
      errors.username = 'El usuario debe tener al menos 3 caracteres';
    }

    if (!formData.password) {
      errors.password = 'La contraseña es requerida';
    } else if (formData.password.length < 6) {
      errors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Confirma tu contraseña';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (validationErrors[field]) {
      setValidationErrors((prev) => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  const register = async () => {
    if (!validateForm()) {
      return;
    }

    setIsRegistering(true);
    try {
      const registerData = {
        email: formData.email.trim().toLowerCase(),
        username: formData.username.trim(),
        password: formData.password,
      };

      const response = await authService.register(registerData);

      if (response.token) {
        await authService.setAuthToken(response.token);
        
        loginContext({
          id: response.user.id,
          email: response.user.email,
          username: response.user.username,
          role: response.user.rol || 'user',
          emailVerificado: response.user.emailVerificado || false,
          googleId: response.user.googleId || null,
        });

        if (response.user.googleId) {
          router.replace('/(tabs)');
        } else {
          router.replace('/verify-email');
        }
      }
    } catch (error) {
      console.error('Error en registro:', error);
      
      const errorMessage = error.response?.data?.error || error.message;
      
      if (errorMessage.toLowerCase().includes('email')) {
        setValidationErrors((prev) => ({
          ...prev,
          email: errorMessage,
        }));
      } else if (errorMessage.toLowerCase().includes('usuario')) {
        setValidationErrors((prev) => ({
          ...prev,
          username: errorMessage,
        }));
      } else {
        Alert.alert(
          'Error en el registro',
          errorMessage || 'No se pudo crear la cuenta. Intenta nuevamente.',
          [{ text: 'Entendido' }]
        );
      }
    } finally {
      setIsRegistering(false);
    }
  };

  return {
    formData,
    validationErrors,
    isRegistering,
    handleChange,
    register,
  };
};

export default useRegisterFlow;