// mobile/hooks/useNotifications.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import notificationService from '../services/notificationService';

export const useNotifications = () => {
  const queryClient = useQueryClient();

  // ⭐ SINTAXIS V5: useQuery con objeto
  const {
    data: notifications = [],
    isLoading,
    error,
    refetch: refetchNotifications,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationService.getMyNotifications(),
    staleTime: 30000,
    retry: 1,
  });

  // ⭐ SINTAXIS V5: Query para contador
  const {
    data: unreadCount = 0,
    refetch: refetchUnreadCount,
  } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => notificationService.getUnreadCount(),
    staleTime: 30000,
  });

  // ⭐ SINTAXIS V5: useMutation con objeto
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      console.log('[useNotifications] All notifications marked as read');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      Alert.alert('Éxito', 'Todas las notificaciones marcadas como leídas');
    },
    onError: (error) => {
      console.error('[useNotifications] Error marking all as read:', error);
      Alert.alert('Error', error.response?.data?.error || 'Error al marcar notificaciones');
    },
  });

  // ⭐ SINTAXIS V5: Mutation con parámetros
  const toggleReadMutation = useMutation({
    mutationFn: ({ notificationId, isRead }) => {
      console.log('[useNotifications] Toggling read status:', { notificationId, isRead });
      return isRead
        ? notificationService.markAsUnread(notificationId)
        : notificationService.markAsRead(notificationId);
    },
    onSuccess: () => {
      console.log('[useNotifications] Notification read status toggled');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    },
    onError: (error) => {
      console.error('[useNotifications] Error toggling read status:', error);
      Alert.alert('Error', error.response?.data?.error || 'Error al actualizar notificación');
    },
  });

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
    isMarkingAllAsRead: markAllAsReadMutation.isPending, // ⭐ isLoading se llama isPending en v5
    isTogglingRead: toggleReadMutation.isPending,
  };
};

export default useNotifications;