// src/services/notificationService.js
import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

class NotificationService {
  /**
   * Obtener token desde localStorage/sessionStorage
   * CRÍTICO: localStorage solo en services
   */
  getToken() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    console.log('[NotificationService] Token retrieved:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    return token;
  }

  /**
   * Obtener todas las notificaciones del usuario
   * @returns {Promise<Array>}
   */
  async getMyNotifications() {
    console.log('[NotificationService] Fetching notifications...');
    try {
      const response = await apiClient.get(ENDPOINTS.NOTIFICATIONS_ME);
      console.log('[NotificationService] Raw response:', response.data);

      // Normalizar respuesta - puede venir en varios formatos
      let notificationsArray = response.data;

      // Si la respuesta es un objeto con propiedad 'notificaciones' o 'data'
      if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        console.log('[NotificationService] Response is object, normalizing...');
        notificationsArray = response.data.notificaciones || response.data.data || [];
      }

      // Si no es un array, retornar array vacío
      if (!Array.isArray(notificationsArray)) {
        console.warn('[NotificationService] Response is not an array, returning empty array');
        return [];
      }

      console.log('[NotificationService] Notifications count:', notificationsArray.length);

      // Ordenar por fecha descendente (más recientes primero)
      const sortedData = notificationsArray.sort(
        (a, b) => new Date(b.fechaEnviada) - new Date(a.fechaEnviada)
      );

      console.log('[NotificationService] First notification:', sortedData[0]);
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
    console.log('[NotificationService] Fetching unread count...');
    try {
      const response = await apiClient.get(ENDPOINTS.NOTIFICATIONS_UNREAD_COUNT);
      console.log('[NotificationService] Unread count response:', response.data);

      const count = response.data?.unreadCount || 0;
      console.log('[NotificationService] Unread count:', count);
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
    console.log('[NotificationService] Marking all as read...');
    try {
      const response = await apiClient.patch(ENDPOINTS.NOTIFICATIONS_MARK_ALL_READ);
      console.log('[NotificationService] Mark all as read response:', response.data);
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
    console.log('[NotificationService] Marking notification as read:', notificationId);
    try {
      const response = await apiClient.patch(ENDPOINTS.NOTIFICATIONS_MARK_READ(notificationId));
      console.log('[NotificationService] Mark as read response:', response.data);
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
    console.log('[NotificationService] Marking notification as unread:', notificationId);
    try {
      const response = await apiClient.patch(ENDPOINTS.NOTIFICATIONS_MARK_UNREAD(notificationId));
      console.log('[NotificationService] Mark as unread response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[NotificationService] Error marking as unread:', error);
      throw error;
    }
  }
}

export default new NotificationService();