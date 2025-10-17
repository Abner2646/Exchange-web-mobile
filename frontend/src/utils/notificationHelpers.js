// src/utils/notificationHelpers.js
import {
  BellIcon,
  ShieldCheckIcon,
  CogIcon,
  ArrowsRightLeftIcon,
  UserGroupIcon,
  ArrowPathIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

/**
 * Obtener icono de notificación según el tipo
 * Centralizado para reutilizar en Navbar y NotificationItem
 * @param {String} tipo - Tipo de notificación
 * @param {String} className - Clase CSS personalizada
 * @returns {JSX.Element}
 */
export const getNotificationIcon = (tipo, className = 'notif-icon') => {
  const iconProps = { className };

  switch (tipo) {
    case 'deposito':
      return <BanknotesIcon {...iconProps} />;
    case 'seguridad':
      return <ShieldCheckIcon {...iconProps} />;
    case 'sistema':
      return <CogIcon {...iconProps} />;
    case 'transaccion':
      return <ArrowsRightLeftIcon {...iconProps} />;
    case 'p2p':
      return <UserGroupIcon {...iconProps} />;
    case 'swap':
      return <ArrowPathIcon {...iconProps} />;
    default:
      return <ExclamationTriangleIcon {...iconProps} />;
  }
};

export default {
  getNotificationIcon,
};