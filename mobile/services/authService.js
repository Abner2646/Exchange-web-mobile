import api from './api';

const authService = {
  // Login con credenciales
  loginWithCredentials: async (emailOrUsername, password) => {
    console.log('🔵 authService - Iniciando login...');
    console.log('🌐 Base URL:', api.defaults.baseURL);
    console.log('📧 Email/Username:', emailOrUsername);
    
    try {
      const response = await api.post('usuario/login', {
        emailOrUsername,
        password,
      });
      console.log('✅ Response exitoso:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error en authService:', error.message);
      console.error('❌ Config:', error.config?.url);
      throw error;
    }
  },

  // Verificar código 2FA
  verify2FA: async (codigo, temporalToken) => {
    const response = await api.post('/usuario/verify-2fa', {
      codigo,
      temporalToken,
    });
    return response.data;
  },

  // Reenviar código 2FA
  resend2FA: async (temporalToken) => {
    const response = await api.post('/usuario/resend-2fa', {
      temporalToken,
    });
    return response.data;
  },

  // Login con Google
  loginWithGoogle: () => {
    console.log('Google login - requiere configuración adicional');
  },

  // Guardar token
  setAuthToken: async (token) => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('token', token);
  },

  // Obtener token
  getAuthToken: async () => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    return await AsyncStorage.getItem('token');
  },
};

export default authService;