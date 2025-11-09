// mobile/services/userService.js
import api from './api';
import { ENDPOINTS } from '../api/endpoints';

class UserService {
  // Buscar usuarios por email o username
  async searchUsers(query, limit = 1) {
    try {
      const response = await api.get(ENDPOINTS.USER_SEARCH, {
        params: { q: query, limit },
      });

      console.log('🔍 Búsqueda de usuarios:', { query, results: response.data?.length || 0 });

      // Normalizar respuesta
      if (Array.isArray(response.data)) return response.data;
      if (response.data?.data) return response.data.data;
      if (response.data?.users) return response.data.users;
      return [];
    } catch (error) {
      console.error('❌ Error buscando usuarios:', error);
      return [];
    }
  }

  // Buscar un usuario específico por email
  async searchByEmail(email) {
    const results = await this.searchUsers(email, 1);
    return results.length > 0 ? results[0] : null;
  }

  // Obtener perfil público de usuario
  async getUserProfile(usuarioId) {
    try {
      const response = await api.get(ENDPOINTS.P2P_USER_PUBLIC_PROFILE(usuarioId));
      console.log(`👤 Perfil de usuario ${usuarioId} obtenido`);
      return response.data;
    } catch (error) {
      console.warn(`No se pudo obtener perfil de usuario ${usuarioId}:`, error);
      return null;
    }
  }

  // Obtener mi perfil completo
  async getMyProfile() {
    try {
      const response = await api.get(ENDPOINTS.USER_PROFILE);
      console.log('👤 Mi perfil obtenido:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error obteniendo mi perfil:', error);
      throw error;
    }
  }

  // Cambiar contraseña
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await api.post(ENDPOINTS.USER_CHANGE_PASSWORD, {
        currentPassword,
        newPassword,
      });
      console.log('✅ Contraseña cambiada exitosamente');
      return response.data;
    } catch (error) {
      console.error('❌ Error cambiando contraseña:', error);
      throw error;
    }
  }

  // Toggle 2FA
  async toggle2FA(enable) {
    try {
      const response = await api.patch(ENDPOINTS.USER_2FA_TOGGLE, {
        enable,
      });
      console.log(`✅ 2FA ${enable ? 'activado' : 'desactivado'} exitosamente`);
      return response.data;
    } catch (error) {
      console.error('❌ Error cambiando estado 2FA:', error);
      throw error;
    }
  }

  // Mock KYC Submit
  async submitKYC(kycData) {
    try {
      // Simular delay de API
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      console.log('📄 KYC enviado (MOCK):', kycData);
      
      // Mock success response
      return {
        success: true,
        message: 'Verificación KYC enviada. Será revisada en 24-48 horas.',
        status: 'pending',
      };
    } catch (error) {
      console.error('❌ Error enviando KYC:', error);
      throw error;
    }
  }

  // Validar que el usuario no sea el mismo que está logueado
  validateDifferentUser(destinatario, currentUser) {
    if (!destinatario || !currentUser) return false;
    return destinatario.id !== currentUser.id;
  }
}

export default new UserService();