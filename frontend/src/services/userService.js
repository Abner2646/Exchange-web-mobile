import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

class UserService {
  //Buscar usuarios por email o username
  async searchUsers(query, limit = 1) {
    try {
      const response = await apiClient.get(ENDPOINTS.USER_SEARCH, {
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

  //Buscar un usuario específico por email
  async searchByEmail(email) {
    const results = await this.searchUsers(email, 1);
    return results.length > 0 ? results[0] : null;
  }

  //NUEVO: Obtener perfil público de usuario
  async getUserProfile(usuarioId) {
    try {
      const response = await apiClient.get(ENDPOINTS.P2P_USER_PUBLIC_PROFILE(usuarioId));
      
      console.log(`👤 Perfil de usuario ${usuarioId} obtenido`);
      
      return response.data;
    } catch (error) {
      console.warn(`No se pudo obtener perfil de usuario ${usuarioId}:`, error);
      return null;
    }
  }

  //Validar que el usuario no sea el mismo que está logueado
  validateDifferentUser(destinatario, currentUser) {
    if (!destinatario || !currentUser) return false;
    return destinatario.id !== currentUser.id;
  }
}

export default new UserService();