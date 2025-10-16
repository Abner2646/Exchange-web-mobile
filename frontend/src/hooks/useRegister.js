import { useState } from 'react';
import { useMutation } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import authService from '../services/authService';
import { useAuth } from '../context/AuthContext';

export const useRegister = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    pais: 'AR',
  });

  const [validationErrors, setValidationErrors] = useState({});

  // Mutation para registro
  const registerMutation = useMutation(
    async (userData) => {
      console.log('🚀 useRegister - Iniciando registro...');
      
      // Validar formulario antes de enviar
      const errors = authService.validateRegistrationForm(userData);
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        throw new Error('Formulario inválido');
      }

      // Remover confirmPassword antes de enviar
      const { confirmPassword, ...registerData } = userData;
      
      // 1. Registrar usuario
      const registerResponse = await authService.register(registerData);
      
      // 2. Intentar login automático
      try {
        // Si el backend devuelve token directamente
        if (registerResponse.token) {
          console.log('✅ Token recibido en registro');
          localStorage.setItem('token', registerResponse.token);
          login({ 
            id: registerResponse.user.id, 
            username: registerResponse.user.username 
          });
          return { success: true, navigateTo: '/' };
        }
        
        // Si no hay token, hacer login con credenciales
        console.log('🔄 Intentando login automático...');
        const loginResponse = await authService.loginWithCredentials(
          registerData.username,
          registerData.password
        );
        
        // Manejar respuesta de login
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
        
        // Login exitoso sin 2FA
        console.log('✅ Login automático exitoso');
        localStorage.setItem('token', loginResponse.token);
        login({ 
          id: loginResponse.user.id, 
          username: loginResponse.user.username 
        });
        return { success: true, navigateTo: '/' };
        
      } catch (loginError) {
        // Si falla el login automático, redirigir a login manual
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
        if (result.navigateTo === '/') {
          toast.success('¡Cuenta creada exitosamente! Bienvenido/a');
        } else {
          toast.success(result.state?.message || '¡Cuenta creada exitosamente!');
        }
        
        navigate(result.navigateTo, { state: result.state });
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

  // Handlers
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Limpiar error específico cuando el usuario empieza a escribir
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationErrors({}); // Limpiar errores previos
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