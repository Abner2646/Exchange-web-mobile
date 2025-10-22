// src/services/authService.js
import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { API_URL } from '../config';

class AuthService {
  // Decodificar JWT sin librerías externas
  decodeToken(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  // Verificar si el token está expirado
  isTokenExpired(token) {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) return true;
    
    const now = Date.now() / 1000;
    return payload.exp < now;
  }

  // Obtener usuario actual (SINCRÓNICO)
  getCurrentUser() {
    const token = this.getAuthToken();
    if (!token || this.isTokenExpired(token)) {
      throw new Error('Token inválido o expirado');
    }

    const payload = this.decodeToken(token);
    
    return {
      id: payload.userId || payload.id || payload.sub,
      email: payload.email,
      username: payload.username || payload.user || payload.name || 'Usuario',
      role: payload.rol || payload.role || 'user',
      emailVerificado: payload.emailVerificado || false, // ⭐ Agregado
    };
  }

  // Validar token con el backend
  async validateToken() {
    try {
      const response = await apiClient.get(ENDPOINTS.USER_PROFILE);
      return response.data;
    } catch (error) {
      this.removeAuthToken();
      throw error;
    }
  }

  // ========== AUTENTICACIÓN ==========

  // Login con Google
  loginWithGoogle() {
    window.location.href = `${API_URL}${ENDPOINTS.AUTH_GOOGLE}`;
  }

  // Login con credenciales (email/username y password)
  async loginWithCredentials(emailOrUsername, password) {
    console.log('🔐 AuthService: Intentando login con credenciales');
    
    const response = await apiClient.post(
      ENDPOINTS.USER_LOGIN,
      { emailOrUsername, password },
      { withCredentials: true }
    );

    console.log('✅ AuthService: Login exitoso');
    return response.data; // { requires2FA?, preAuthToken?, token?, user? }
  }

  // Registro de usuario
  async register(userData) {
    console.log('📝 AuthService: Registrando usuario');
    const response = await apiClient.post(ENDPOINTS.USER_REGISTER, userData);
    console.log('✅ AuthService: Registro exitoso');
    return response.data;
  }

  // Logout
  async logout() {
    try {
      await apiClient.post(ENDPOINTS.AUTH_LOGOUT);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      this.removeAuthToken();
    }
  }

  // ========== VERIFICACIÓN DE EMAIL ==========

  /**
   * Verificar email con código de 6 dígitos
   * @param {String} codigo - Código de verificación de 6 dígitos
   * @returns {Promise<Object>}
   */
  async verifyEmail(codigo) {
    console.log('📧 AuthService: Verificando email con código');
    
    const response = await apiClient.post(ENDPOINTS.USER_VERIFY_EMAIL, {
      codigo
    });

    console.log('✅ AuthService: Email verificado exitosamente');
    return response.data;
  }

  /**
   * Reenviar código de verificación de email
   * @returns {Promise<Object>}
   */
  async resendVerificationEmail() {
    console.log('📧 AuthService: Reenviando código de verificación');
    
    const response = await apiClient.post(ENDPOINTS.USER_RESEND_VERIFICATION_EMAIL);

    console.log('✅ AuthService: Código de verificación reenviado');
    return response.data;
  }

  // ========== 2FA ==========

  // Verificar código 2FA
  async verify2FA(codigo, preAuthToken) {
    console.log('🔐 AuthService: Verificando código 2FA');
    
    const response = await apiClient.post(
      ENDPOINTS.USER_VERIFY_2FA,
      { codigo },
      {
        headers: { Authorization: preAuthToken },
        withCredentials: true,
      }
    );

    console.log('✅ AuthService: 2FA verificado');
    return response.data; // { token, user }
  }

  // Reenviar código 2FA
  async resend2FA(preAuthToken) {
    console.log('📧 AuthService: Reenviando código 2FA');
    
    const response = await apiClient.post(
      ENDPOINTS.USER_RESEND_2FA,
      { preAuthToken },
      { withCredentials: true }
    );

    console.log('✅ AuthService: Código reenviado');
    return response.data;
  }

  // ========== USUARIOS ==========

  // Obtener perfil del usuario
  async getProfile() {
    console.log('👤 AuthService: Obteniendo perfil');
    const response = await apiClient.get(ENDPOINTS.USER_PROFILE);
    console.log('✅ AuthService: Perfil obtenido:', response.data);
    return response.data;
  }

  // Buscar usuario por email
  async searchUser(email) {
    const response = await apiClient.get(ENDPOINTS.USER_SEARCH, {
      params: { q: email, limit: 1 }
    });
    return response.data;
  }

  // ========== ⭐ CONFIGURACIÓN DE PERFIL (NUEVOS) ==========

  /**
   * Cambiar contraseña del usuario
   * @param {String} currentPassword - Contraseña actual
   * @param {String} newPassword - Nueva contraseña
   * @returns {Promise<Object>}
   */
  async changePassword(currentPassword, newPassword) {
    console.log('🔐 AuthService: Cambiando contraseña');
    
    const response = await apiClient.patch(ENDPOINTS.USER_CHANGE_PASSWORD, {
      currentPassword,
      newPassword,
    });

    console.log('✅ AuthService: Contraseña cambiada exitosamente');
    return response.data;
  }

  /**
   * Activar/desactivar autenticación de dos factores
   * @returns {Promise<Object>} { is2FAEnabled: boolean }
   */
  async toggle2FA() {
    console.log('🔐 AuthService: Toggle 2FA');
    
    const response = await apiClient.patch(ENDPOINTS.USER_2FA_TOGGLE);

    console.log('✅ AuthService: 2FA toggled:', response.data);
    return response.data;
  }

  // ========== TOKEN MANAGEMENT (localStorage) ==========
  // ⭐ Estos métodos CENTRALIZAN el acceso a localStorage
  // En React Native, solo cambiar a AsyncStorage aquí

  // Guardar token JWT
  setAuthToken(token) {
    if (token) {
      localStorage.setItem('token', token);
      console.log('💾 AuthService: Token guardado');
    }
  }

  // Obtener token JWT
  getAuthToken() {
    return localStorage.getItem('token');
  }

  // Eliminar token JWT
  removeAuthToken() {
    localStorage.removeItem('token');
    console.log('🗑️ AuthService: Token eliminado');
  }
}

export default new AuthService();