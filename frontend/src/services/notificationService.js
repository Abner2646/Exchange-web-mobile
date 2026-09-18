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

      const typeMap = {
        security: 'seguridad',
        transaction: 'transaccion',
        kyc: 'seguridad',
        system: 'sistema',
        p2p: 'p2p',
        exchange: 'swap',
      };

      const normalized = notificationsArray.map((notif) => {
        const rawType = notif.type || notif.tipo || 'system';
        const mappedType = typeMap[rawType] || rawType;
        const title = notif.title || notif.titulo || 'Notificación';
        const message = notif.message || notif.mensaje || '';
        const isRead = notif.read !== undefined ? Boolean(notif.read) : (notif.leida !== undefined ? Boolean(notif.leida) : false);
        const isImportant = notif.important !== undefined ? Boolean(notif.important) : (notif.importante !== undefined ? Boolean(notif.importante) : false);
        const dateValue = notif.sentAt || notif.sent_at || notif.createdAt || notif.created_at || notif.fechaEnviada || new Date().toISOString();

        return {
          ...notif,
          id: notif.id,
          title,
          titulo: title,
          message,
          mensaje: message,
          type: rawType,
          tipo: mappedType,
          read: isRead,
          leida: isRead,
          important: isImportant,
          importante: isImportant,
          sentAt: dateValue,
          fechaEnviada: dateValue,
          createdAt: notif.createdAt || notif.created_at || dateValue,
          fecha: dateValue,
        };
      });

      // Ordenar por fecha descendente (más recientes primero)
      const sortedData = normalized.sort((a, b) => {
        const dateA = new Date(a.fechaEnviada || a.createdAt).getTime();
        const dateB = new Date(b.fechaEnviada || b.createdAt).getTime();
        return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
      });

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