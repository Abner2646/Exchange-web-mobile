// mobile/components/notifications/NotificationBell.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../hooks/useNotifications';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import NotificationItem from './NotificationItem';

export default function NotificationBell() {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const {
    notifications,
    unreadCount,
    isLoading,
    refetchNotifications,
    refetchUnreadCount,
    markAllAsRead,
  } = useNotifications();

  // Auto-refresh cada 60 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      refetchUnreadCount();
    }, 60000);

    return () => clearInterval(interval);
  }, [refetchUnreadCount]);

  // Refetch cuando se abre el modal
  const handleOpenModal = () => {
    setModalVisible(true);
    refetchNotifications();
    refetchUnreadCount();
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  return (
    <>
      {/* Botón de campana */}
      <TouchableOpacity
        style={styles.bellButton}
        onPress={handleOpenModal}
      >
        <Ionicons name="notifications-outline" size={24} color={theme.textPrimary} />
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: theme.error }]}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Modal de notificaciones */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                Notificaciones
              </Text>
              <View style={styles.modalHeaderActions}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    style={styles.markAllButton}
                    onPress={handleMarkAllAsRead}
                  >
                    <Ionicons name="checkmark-done-outline" size={20} color={theme.brandPrimary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Lista de notificaciones */}
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.brandPrimary} />
                <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                  Cargando notificaciones...
                </Text>
              </View>
            ) : notifications.length > 0 ? (
              <FlatList
                data={notifications}
                renderItem={({ item }) => (
                  <NotificationItem notification={item} />
                )}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={
                  <RefreshControl
                    refreshing={isLoading}
                    onRefresh={refetchNotifications}
                    tintColor={theme.brandPrimary}
                    colors={[theme.brandPrimary]}
                  />
                }
                ItemSeparatorComponent={() => (
                  <View style={[styles.separator, { backgroundColor: theme.border }]} />
                )}
              />
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="notifications-off-outline" size={64} color={theme.textMuted} />
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No hay notificaciones
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellButton: {
    position: 'relative',
    padding: spacing.xs,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '80%',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  markAllButton: {
    padding: spacing.xs,
  },
  closeButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.sm,
  },
  listContent: {
    padding: spacing.md,
  },
  separator: {
    height: 1,
    marginVertical: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
  },
});