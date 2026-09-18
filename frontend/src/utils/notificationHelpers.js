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
  const normalizedType = String(tipo || '').toLowerCase();

  switch (normalizedType) {
    case 'deposito':
    case 'deposit':
      return <BanknotesIcon {...iconProps} />;
    case 'seguridad':
    case 'security':
    case 'kyc':
      return <ShieldCheckIcon {...iconProps} />;
    case 'sistema':
    case 'system':
      return <CogIcon {...iconProps} />;
    case 'transaccion':
    case 'transaction':
      return <ArrowsRightLeftIcon {...iconProps} />;
    case 'p2p':
      return <UserGroupIcon {...iconProps} />;
    case 'swap':
    case 'exchange':
      return <ArrowPathIcon {...iconProps} />;
    default:
      return <BellIcon {...iconProps} />;
  }
};

export default {
  getNotificationIcon,
};