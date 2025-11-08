// mobile/services/authService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import api from './api';
import { ENDPOINTS } from '../api/endpoints';

WebBrowser.maybeCompleteAuthSession();

class AuthService {
  constructor() {
    this.API_URL = api.defaults.baseURL.replace('/api', '');
  }

  // ==================== DECODIFICACIÓN DE TOKEN ====================

  decodeToken(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  isTokenExpired(token) {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) return true;
    
    const now = Date.now() / 1000;
    return payload.exp < now;
  }

  getCurrentUser() {
    const token = this.getAuthTokenSync();
    if (!token || this.isTokenExpired(token)) {
      throw new Error('Token inválido o expirado');
    }

    const payload = this.decodeToken(token);
    
    return {
      id: payload.userId || payload.id || payload.sub,
      email: payload.email,
      username: payload.username || payload.user || payload.name || 'Usuario',
      role: payload.rol || payload.role || 'user',
      emailVerificado: payload.emailVerificado || false,
      googleId: payload.googleId || null,
    };
  }

  // ==================== GOOGLE OAUTH ====================

  async loginWithGoogle() {
    try {
      console.log('Iniciando Google OAuth...');

      const authUrl = `${this.API_URL}${ENDPOINTS.AUTH_GOOGLE}`;
      const redirectUri = 'cryptoexchange://auth-success';

      console.log('Auth URL:', authUrl);
      console.log('Redirect URI:', redirectUri);

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUri
      );

      if (result.type === 'success') {
        const url = result.url;
        const token = this.extractTokenFromUrl(url);
        const isNewUser = url.includes('new=true');

        if (!token) {
          throw new Error('No se recibió token del servidor');
        }

        await this.setAuthToken(token);
        const user = this.getCurrentUser();

        console.log('Google OAuth exitoso');
        return { token, user, isNewUser };
      } else if (result.type === 'cancel') {
        throw new Error('Autenticación cancelada');
      } else {
        throw new Error('Error en autenticación con Google');
      }
    } catch (error) {
      console.error('Error en Google OAuth:', error);
      throw error;
    }
  }

  extractTokenFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('token');
    } catch (error) {
      console.error('Error extrayendo token de URL:', error);
      return null;
    }
  }

  // ==================== AUTENTICACIÓN CON CREDENCIALES ====================

  async loginWithCredentials(emailOrUsername, password) {
    console.log('Iniciando login con credenciales...');
    
    const response = await api.post(ENDPOINTS.USER_LOGIN, {
      emailOrUsername,
      password,
    });

    console.log('Login exitoso');
    return response.data;
  }

  // ==================== REGISTRO ====================

  async register(userData) {
    console.log('Iniciando registro de usuario...');
    
    const response = await api.post(ENDPOINTS.USER_REGISTER, userData);

    console.log('Registro exitoso');
    return response.data;
  }

  // ==================== 2FA ====================

  async verify2FA(codigo, temporalToken) {
    console.log('Verificando código 2FA...');
    
    const response = await api.post(ENDPOINTS.USER_VERIFY_2FA, {
      codigo,
      temporalToken,
    });

    console.log('2FA verificado');
    return response.data;
  }

  async resend2FA(temporalToken) {
    console.log('Reenviando código 2FA...');
    
    const response = await api.post(ENDPOINTS.USER_RESEND_2FA, {
      temporalToken,
    });

    console.log('Código 2FA reenviado');
    return response.data;
  }

  // ==================== RECUPERACIÓN DE CONTRASEÑA ====================

  async requestPasswordReset(email) {
    console.log('Solicitando código de recuperación...');
    
    const response = await api.post(ENDPOINTS.USER_FORGOT_PASSWORD, {
      email,
    });

    console.log('Código de recuperación enviado');
    return response.data;
  }

  async verifyResetCode(email, codigo) {
    console.log('Verificando código de recuperación...');
    
    const response = await api.post(ENDPOINTS.USER_VERIFY_RESET_CODE, {
      email,
      codigo,
    });

    console.log('Código verificado');
    return response.data;
  }

  async resetPassword(email, codigo, newPassword) {
    console.log('Reseteando contraseña...');
    
    const response = await api.post(ENDPOINTS.USER_RESET_PASSWORD, {
      email,
      codigo,
      newPassword,
    });

    console.log('Contraseña reseteada exitosamente');
    return response.data;
  }

  // ==================== VERIFICACIÓN DE EMAIL ====================

  async verifyEmail(codigo) {
    console.log('Verificando email...');
    
    const response = await api.post(ENDPOINTS.USER_VERIFY_EMAIL, {
      codigo,
    });

    console.log('Email verificado');
    return response.data;
  }

  async resendVerificationEmail() {
    console.log('Reenviando código de verificación...');
    
    const response = await api.post(ENDPOINTS.USER_RESEND_VERIFICATION_EMAIL);

    console.log('Código de verificación reenviado');
    return response.data;
  }

  // ==================== PERFIL ====================

  async getProfile() {
    console.log('Obteniendo perfil...');
    const response = await api.get(ENDPOINTS.USER_PROFILE);
    return response.data;
  }

  async changePassword(currentPassword, newPassword) {
    console.log('Cambiando contraseña...');
    
    const response = await api.patch(ENDPOINTS.USER_CHANGE_PASSWORD, {
      currentPassword,
      newPassword,
    });

    console.log('Contraseña cambiada');
    return response.data;
  }

  async toggle2FA() {
    console.log('Toggle 2FA...');
    
    const response = await api.patch(ENDPOINTS.USER_2FA_TOGGLE);

    console.log('2FA toggled');
    return response.data;
  }

  // ==================== LOGOUT ====================

  async logout() {
    try {
      await api.post(ENDPOINTS.AUTH_LOGOUT);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      await this.removeAuthToken();
    }
  }

  // ==================== TOKEN MANAGEMENT ====================

  async setAuthToken(token) {
    if (token) {
      await AsyncStorage.setItem('token', token);
      console.log('Token guardado');
    }
  }

  async getAuthToken() {
    return await AsyncStorage.getItem('token');
  }

  getAuthTokenSync() {
    try {
      return AsyncStorage.getItem('token');
    } catch (error) {
      return null;
    }
  }

  async removeAuthToken() {
    await AsyncStorage.removeItem('token');
    console.log('Token eliminado');
  }
}

export default new AuthService();