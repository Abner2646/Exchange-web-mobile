// mobile/services/notificationService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { ENDPOINTS } from '../api/endpoints';

class NotificationService {
  async getToken() {
    const token = await AsyncStorage.getItem('token');
    console.log('[NotificationService] Token retrieved:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN');
    return token;
  }

  async getMyNotifications() {
    console.log('[NotificationService] Fetching notifications...');
    try {
      const response = await api.get(ENDPOINTS.NOTIFICATIONS_ME);
      console.log('[NotificationService] Raw response:', response.data);

      let notificationsArray = response.data;

      if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        console.log('[NotificationService] Response is object, normalizing...');
        notificationsArray = response.data.notificaciones || response.data.data || [];
      }

      if (!Array.isArray(notificationsArray)) {
        console.warn('[NotificationService] Response is not an array, returning empty array');
        return [];
      }

      console.log('[NotificationService] Notifications count:', notificationsArray.length);

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

  async getUnreadCount() {
    console.log('[NotificationService] Fetching unread count...');
    try {
      const response = await api.get(ENDPOINTS.NOTIFICATIONS_UNREAD_COUNT);
      console.log('[NotificationService] Unread count response:', response.data);

      const count = response.data?.unreadCount || 0;
      console.log('[NotificationService] Unread count:', count);
      return count;
    } catch (error) {
      console.error('[NotificationService] Error fetching unread count:', error);
      throw error;
    }
  }

  async markAllAsRead() {
    console.log('[NotificationService] Marking all as read...');
    try {
      const response = await api.patch(ENDPOINTS.NOTIFICATIONS_MARK_ALL_READ);
      console.log('[NotificationService] Mark all as read response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[NotificationService] Error marking all as read:', error);
      throw error;
    }
  }

  async markAsRead(notificationId) {
    console.log('[NotificationService] Marking notification as read:', notificationId);
    try {
      const response = await api.patch(ENDPOINTS.NOTIFICATIONS_MARK_READ(notificationId));
      console.log('[NotificationService] Mark as read response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[NotificationService] Error marking as read:', error);
      throw error;
    }
  }

  async markAsUnread(notificationId) {
    console.log('[NotificationService] Marking notification as unread:', notificationId);
    try {
      const response = await api.patch(ENDPOINTS.NOTIFICATIONS_MARK_UNREAD(notificationId));
      console.log('[NotificationService] Mark as unread response:', response.data);
      return response.data;
    } catch (error) {
      console.error('[NotificationService] Error marking as unread:', error);
      throw error;
    }
  }
}

export default new NotificationService();