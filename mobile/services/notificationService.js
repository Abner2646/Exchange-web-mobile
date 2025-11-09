// mobile/services/notificationService.js
import api from './api';
import { ENDPOINTS } from '../api/endpoints';

class NotificationService {
  /**
   * Obtener todas las notificaciones del usuario
   * @returns {Promise<Array>}
   */
  async getMyNotifications() {
    try {
      const response = await api.get(ENDPOINTS.NOTIFICATIONS_ME);

      let notificationsArray = response.data;

      if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        notificationsArray = response.data.notificaciones || response.data.data || [];
      }

      if (!Array.isArray(notificationsArray)) {
        console.warn('[NotificationService] Response is not an array');
        return [];
      }

      // Ordenar por fecha descendente (más recientes primero)
      const sortedData = notificationsArray.sort(
        (a, b) => new Date(b.fechaEnviada) - new Date(a.fechaEnviada)
      );

      return sortedData;
    } catch (error) {
      console.error('[NotificationService] Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Obtener contador de notificaciones no leídas
   * @returns {Promise<Number>}
   */
  async getUnreadCount() {
    try {
      const response = await api.get(ENDPOINTS.NOTIFICATIONS_UNREAD_COUNT);
      const count = response.data?.unreadCount || 0;
      return count;
    } catch (error) {
      console.error('[NotificationService] Error fetching unread count:', error);
      throw error;
    }
  }

  /**
   * Marcar todas las notificaciones como leídas
   * @returns {Promise<Object>}
   */
  async markAllAsRead() {
    try {
      const response = await api.patch(ENDPOINTS.NOTIFICATIONS_MARK_ALL_READ);
      return response.data;
    } catch (error) {
      console.error('[NotificationService] Error marking all as read:', error);
      throw error;
    }
  }

  /**
   * Marcar una notificación como leída
   * @param {Number} notificationId - ID de la notificación
   * @returns {Promise<Object>}
   */
  async markAsRead(notificationId) {
    try {
      const response = await api.patch(ENDPOINTS.NOTIFICATIONS_MARK_READ(notificationId));
      return response.data;
    } catch (error) {
      console.error('[NotificationService] Error marking as read:', error);
      throw error;
    }
  }

  /**
   * Marcar una notificación como no leída
   * @param {Number} notificationId - ID de la notificación
   * @returns {Promise<Object>}
   */
  async markAsUnread(notificationId) {
    try {
      const response = await api.patch(ENDPOINTS.NOTIFICATIONS_MARK_UNREAD(notificationId));
      return response.data;
    } catch (error) {
      console.error('[NotificationService] Error marking as unread:', error);
      throw error;
    }
  }
}

export default new NotificationService();