// mobile/components/notifications/NotificationItem.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../constants/theme';
import { getNotificationIcon, formatRelativeDate } from '../../utils/notificationHelpers';
import { useNotifications } from '../../hooks/useNotifications';

export default function NotificationItem({ notification }) {
  const { theme } = useTheme();
  const { markAsRead, markAsUnread } = useNotifications();

  const handleToggleRead = () => {
    if (notification.leida) {
      markAsUnread(notification.id);
    } else {
      markAsRead(notification.id);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: notification.leida ? theme.backgroundElevated : theme.brandTertiary,
        }
      ]}
      onPress={handleToggleRead}
      activeOpacity={0.7}
    >
      {/* Icono */}
      <View style={[styles.iconContainer, { backgroundColor: theme.brandTertiary }]}>
        {getNotificationIcon(notification.tipo, 20, theme.brandPrimary)}
      </View>

      {/* Contenido */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
          {notification.titulo}
        </Text>
        <Text style={[styles.message, { color: theme.textSecondary }]} numberOfLines={2}>
          {notification.mensaje}
        </Text>
        <Text style={[styles.time, { color: theme.textMuted }]}>
          {formatRelativeDate(notification.fechaEnviada)}
        </Text>
      </View>

      {/* Indicador de no leída */}
      {!notification.leida && (
        <View style={[styles.unreadDot, { backgroundColor: theme.brandPrimary }]} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  message: {
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  time: {
    fontSize: fontSize.xs,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
});