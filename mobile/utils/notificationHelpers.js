// mobile/utils/notificationHelpers.js
import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * Obtener icono de notificación según el tipo
 * @param {String} tipo - Tipo de notificación
 * @param {Number} size - Tamaño del icono
 * @param {String} color - Color del icono
 * @returns {JSX.Element}
 */
export const getNotificationIcon = (tipo, size = 20, color = '#0052FF') => {
  switch (tipo) {
    case 'deposito':
      return <MaterialCommunityIcons name="cash-plus" size={size} color={color} />;
    case 'seguridad':
      return <Ionicons name="shield-checkmark-outline" size={size} color={color} />;
    case 'sistema':
      return <Ionicons name="settings-outline" size={size} color={color} />;
    case 'transaccion':
      return <Ionicons name="swap-horizontal-outline" size={size} color={color} />;
    case 'p2p':
      return <Ionicons name="people-outline" size={size} color={color} />;
    case 'swap':
      return <Ionicons name="repeat-outline" size={size} color={color} />;
    default:
      return <Ionicons name="alert-circle-outline" size={size} color={color} />;
  }
};

/**
 * Formatear fecha relativa (ej: "hace 2 horas")
 * @param {String} dateString - Fecha en formato ISO
 * @returns {String}
 */
export const formatRelativeDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now - date;
  const diffInMinutes = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return 'Ahora';
  if (diffInMinutes < 60) return `Hace ${diffInMinutes}m`;
  if (diffInHours < 24) return `Hace ${diffInHours}h`;
  if (diffInDays < 7) return `Hace ${diffInDays}d`;
  
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};