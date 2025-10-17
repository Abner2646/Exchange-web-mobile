// src/components/features/NotificationItem.jsx
//cÓDIOG HAST ANTS DE REFACTORIZAR LA NAVBAR

/*
import { CheckIcon } from '@heroicons/react/24/outline';
import { CheckIcon as CheckIconSolid } from '@heroicons/react/24/solid';
import {
  BellIcon,
  ShieldCheckIcon,
  CogIcon,
  ArrowsRightLeftIcon,
  UsersIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { formatRelativeDate } from '../../utils/formatters';

const NotificationItem = ({ notification, onToggleRead }) => {
  const getNotificationIcon = (tipo) => {
    const iconProps = { className: 'notif-icon' };
    switch (tipo) {
      case 'deposito':
        return <BellIcon {...iconProps} />;
      case 'seguridad':
        return <ShieldCheckIcon {...iconProps} />;
      case 'sistema':
        return <CogIcon {...iconProps} />;
      case 'transaccion':
        return <ArrowsRightLeftIcon {...iconProps} />;
      case 'p2p':
        return <UsersIcon {...iconProps} />;
      case 'swap':
        return <ArrowPathIcon {...iconProps} />;
      default:
        return <BellIcon {...iconProps} />;
    }
  };

  const handleToggleClick = (e) => {
    e.stopPropagation();
    onToggleRead(notification);
  };

  return (
    <div className={`notif-item ${!notification.leida ? 'unread' : ''}`}>
      {!notification.leida && <div className="notif-unread-indicator"></div>}

      <div className="notif-item-icon-wrapper">{getNotificationIcon(notification.tipo)}</div>

      <div className="notif-item-content">
        <h3 className="notif-item-title">{notification.titulo}</h3>
        <p className="notif-item-message">{notification.mensaje}</p>
      </div>

      <div className="notif-item-right">
        <span className="notif-item-time">{formatRelativeDate(notification.fechaEnviada)}</span>

        <button
          className={`notif-toggle-btn ${notification.leida ? 'read' : 'unread'}`}
          onClick={handleToggleClick}
          title={notification.leida ? 'Marcar como no leída' : 'Marcar como leída'}
        >
          {notification.leida ? (
            <CheckIconSolid className="notif-toggle-icon" />
          ) : (
            <CheckIcon className="notif-toggle-icon" />
          )}
        </button>
      </div>
    </div>
  );
};

export default NotificationItem;*/

// src/components/features/NotificationItem.jsx
import { CheckIcon } from '@heroicons/react/24/outline';
import { CheckIcon as CheckIconSolid } from '@heroicons/react/24/solid';
import { formatRelativeDate } from '../../utils/formatters';
import { getNotificationIcon } from '../../utils/notificationHelpers';

const NotificationItem = ({ notification, onToggleRead }) => {
  const handleToggleClick = (e) => {
    e.stopPropagation();
    onToggleRead(notification);
  };

  return (
    <div className={`notif-item ${!notification.leida ? 'unread' : ''}`}>
      {!notification.leida && <div className="notif-unread-indicator"></div>}

      <div className="notif-item-icon-wrapper">
        {getNotificationIcon(notification.tipo, 'notif-icon')}
      </div>

      <div className="notif-item-content">
        <h3 className="notif-item-title">{notification.titulo}</h3>
        <p className="notif-item-message">{notification.mensaje}</p>
      </div>

      <div className="notif-item-right">
        <span className="notif-item-time">{formatRelativeDate(notification.fechaEnviada)}</span>

        <button
          className={`notif-toggle-btn ${notification.leida ? 'read' : 'unread'}`}
          onClick={handleToggleClick}
          title={notification.leida ? 'Marcar como no leída' : 'Marcar como leída'}
        >
          {notification.leida ? (
            <CheckIconSolid className="notif-toggle-icon" />
          ) : (
            <CheckIcon className="notif-toggle-icon" />
          )}
        </button>
      </div>
    </div>
  );
};

export default NotificationItem;