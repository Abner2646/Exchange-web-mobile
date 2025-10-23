// src/hooks/useRegister.js
import { useState } from 'react';
import { useMutation } from 'react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import authService from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { validateRegistrationForm } from '../utils/validators';

export const useRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const from = location.state?.from?.pathname || '/';

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const [validationErrors, setValidationErrors] = useState({});

  const registerMutation = useMutation(
    async (userData) => {
      console.log('🚀 useRegister - Iniciando registro...');
      
      const errors = validateRegistrationForm(userData);
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        throw new Error('Formulario inválido');
      }

      const { confirmPassword, ...registerData } = userData;
      
      const registerResponse = await authService.register(registerData);
      
      try {
        if (registerResponse.token) {
          console.log('✅ Token recibido en registro');
          authService.setAuthToken(registerResponse.token);
          
          const userData = {
            id: registerResponse.user.id, 
            username: registerResponse.user.username,
            email: registerResponse.user.email,
            emailVerificado: registerResponse.user.emailVerificado || false,
            googleId: registerResponse.user.googleId || null, // ⭐ Detectar si es usuario de Google
          };
          
          login(userData);
          
          // ⭐ LÓGICA DE REDIRECCIÓN SEGÚN TIPO DE USUARIO
          // Si es usuario de Google (googleId existe) → home
          // Si es usuario tradicional (sin googleId) → verificar email
          if (userData.googleId) {
            console.log('👤 Usuario de Google detectado - Redirigiendo a home');
            return { 
              success: true, 
              navigateTo: '/',
              isGoogleUser: true,
            };
          } else {
            console.log('📧 Usuario tradicional - Redirigiendo a verificar email');
            return { 
              success: true, 
              navigateTo: '/verificar-email',
              state: { email: registerResponse.user.email },
              isGoogleUser: false,
            };
          }
        }
        
        console.log('🔄 Intentando login automático...');
        const loginResponse = await authService.loginWithCredentials(
          registerData.username,
          registerData.password
        );
        
        if (loginResponse.requires2FA) {
          console.log('🔐 Requiere 2FA');
          return {
            success: true,
            navigateTo: '/login',
            state: {
              message: 'Cuenta creada exitosamente. Completa la verificación 2FA.',
              username: registerData.username,
            },
          };
        }
        
        console.log('✅ Login automático exitoso');
        authService.setAuthToken(loginResponse.token);
        
        const userData = {
          id: loginResponse.user.id, 
          username: loginResponse.user.username,
          email: loginResponse.user.email || registerData.email,
          emailVerificado: loginResponse.user.emailVerificado || false,
          googleId: loginResponse.user.googleId || null, // ⭐ Detectar si es usuario de Google
        };
        
        login(userData);
        
        // ⭐ LÓGICA DE REDIRECCIÓN SEGÚN TIPO DE USUARIO
        if (userData.googleId) {
          console.log('👤 Usuario de Google detectado - Redirigiendo a home');
          return { 
            success: true, 
            navigateTo: '/',
            isGoogleUser: true,
          };
        } else {
          console.log('📧 Usuario tradicional - Redirigiendo a verificar email');
          return { 
            success: true, 
            navigateTo: '/verificar-email',
            state: { email: loginResponse.user.email || registerData.email },
            isGoogleUser: false,
          };
        }
        
      } catch (loginError) {
        console.warn('⚠️ Login automático falló, redirigiendo a login:', loginError);
        return {
          success: true,
          navigateTo: '/login',
          state: {
            message: 'Cuenta creada exitosamente. Inicia sesión con tus credenciales.',
            username: registerData.username,
          },
        };
      }
    },
    {
      onSuccess: (result) => {
        if (result.navigateTo === '/login') {
          toast.success(result.state?.message || '¡Cuenta creada exitosamente!');
        } else if (result.navigateTo === '/verificar-email') {
          toast.success('¡Cuenta creada exitosamente! Ahora verifica tu email', {
            duration: 4000,
          });
        } else if (result.navigateTo === '/' && result.isGoogleUser) {
          // Usuario de Google - email ya verificado
          toast.success('¡Bienvenido/a! Tu cuenta está lista', {
            duration: 3000,
            icon: '🎉',
          });
        } else {
          toast.success('¡Cuenta creada exitosamente! Bienvenido/a');
        }
        
        navigate(result.navigateTo, { state: result.state, replace: true });
      },
      onError: (error) => {
        console.error('❌ Error en registro:', error);
        
        if (error.message === 'Formulario inválido') {
          toast.error('Por favor, corrige los errores en el formulario');
          return;
        }
        
        const errorMessage = 
          error.response?.data?.error || 
          error.message || 
          'Error al crear la cuenta. Por favor, inténtalo de nuevo.';
        
        toast.error(errorMessage);
      },
    }
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationErrors({});
    registerMutation.mutate(formData);
  };

  return {
    formData,
    validationErrors,
    isLoading: registerMutation.isLoading,
    handleChange,
    handleSubmit,
  };
};

export default useRegister;