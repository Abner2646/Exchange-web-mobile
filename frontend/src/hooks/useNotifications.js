// src/hooks/useNotifications.js
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import notificationService from '../services/notificationService';

export const useNotifications = () => {
  const queryClient = useQueryClient();

  // Query para obtener todas las notificaciones 
  const {
    data: notifications = [],
    isLoading,
    error,
    refetch: refetchNotifications,
  } = useQuery('notifications', () => notificationService.getMyNotifications(), {
    staleTime: 30000, // 30 segundos
    onSuccess: (data) => {
      console.log('[useNotifications] Notifications loaded:', data.length);
    },
    onError: (error) => {
      console.error('[useNotifications] Error loading notifications:', error);
      toast.error('Error al cargar notificaciones');
    },
  });

  // Query para obtener contador de no leídas
  const {
    data: unreadCount = 0,
    refetch: refetchUnreadCount,
  } = useQuery('unreadCount', () => notificationService.getUnreadCount(), {
    staleTime: 30000,
    onSuccess: (count) => {
      console.log('[useNotifications] Unread count:', count);
    },
  });

  // Mutation para marcar todas como leídas
  const markAllAsReadMutation = useMutation(() => notificationService.markAllAsRead(), {
    onSuccess: () => {
      console.log('[useNotifications] All notifications marked as read');
      queryClient.invalidateQueries('notifications');
      queryClient.invalidateQueries('unreadCount');
      toast.success('Todas las notificaciones marcadas como leídas');
    },
    onError: (error) => {
      console.error('[useNotifications] Error marking all as read:', error);
      toast.error(error.response?.data?.error || 'Error al marcar notificaciones');
    },
  });

  // Mutation para toggle read status (marcar como leída/no leída)
  const toggleReadMutation = useMutation(
    ({ notificationId, isRead }) => {
      console.log('[useNotifications] Toggling read status:', { notificationId, isRead });
      return isRead
        ? notificationService.markAsUnread(notificationId)
        : notificationService.markAsRead(notificationId);
    },
    {
      onSuccess: () => {
        console.log('[useNotifications] Notification read status toggled');
        queryClient.invalidateQueries('notifications');
        queryClient.invalidateQueries('unreadCount');
      },
      onError: (error) => {
        console.error('[useNotifications] Error toggling read status:', error);
        toast.error(error.response?.data?.error || 'Error al actualizar notificación');
      },
    }
  );

  return {
    // Data
    notifications,
    unreadCount,
    isLoading,
    error,

    // Actions
    markAllAsRead: markAllAsReadMutation.mutate,
    toggleRead: (notification) =>
      toggleReadMutation.mutate({
        notificationId: notification.id,
        isRead: notification.leida,
      }),
    refetchNotifications,
    refetchUnreadCount,

    // Loading states
    isMarkingAllAsRead: markAllAsReadMutation.isLoading,
    isTogglingRead: toggleReadMutation.isLoading,
  };
};

export default useNotifications;