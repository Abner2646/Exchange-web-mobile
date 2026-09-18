// src/components/features/NotificationsDropdown.jsx
import { Link } from 'react-router-dom';
import { CheckIcon, EyeIcon } from '@heroicons/react/24/outline';
import { formatRelativeDate } from '../../utils/formatters';
import { getNotificationIcon } from '../../utils/notificationHelpers'; 

const NotificationsDropdown = ({
  notifications,
  unreadCount,
  isLoading,
  onMarkAllAsRead,
  onClose,
  onMouseEnter,
  onMouseLeave,
}) => {
  return (
    <div
      className="navbar-dropdown-menu navbar-notifications-menu"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Header */}
      <div className="navbar-notifications-header">
        <h3>Notificaciones</h3>
        {unreadCount > 0 && (
          <button
            className="navbar-notifications-mark-read"
            onClick={onMarkAllAsRead}
            title="Marcar todas como leídas"
          >
            <CheckIcon className="navbar-notifications-mark-read-icon" />
          </button>
        )}
      </div>

      {/* Lista de notificaciones */}
      <div className="navbar-notifications-list">
        {isLoading ? (
          <div className="navbar-notification-loading">Cargando notificaciones...</div>
        ) : notifications.length > 0 ? (
          notifications.slice(0, 5).map((notification) => {
            const isUnread = !(notification.leida ?? notification.read);
            const title = notification.titulo || notification.title || 'Notificación';
            const message = notification.mensaje || notification.message || '';
            const type = notification.tipo || notification.type || 'sistema';
            const date = notification.fechaEnviada || notification.sentAt || notification.createdAt;

            return (
              <div
                key={notification.id}
                className={`navbar-notification-item ${
                  isUnread ? 'navbar-notification-unread' : ''
                }`}
              >
                <div className="navbar-notification-icon-wrapper">
                  {getNotificationIcon(type, 'navbar-notification-custom-icon')}
                </div>
                <div className="navbar-notification-content">
                  <p className="navbar-notification-title">{title}</p>
                  {message && <p className="navbar-notification-message">{message}</p>}
                  <span className="navbar-notification-time">
                    {formatRelativeDate(date)}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="navbar-notification-empty">No hay notificaciones</div>
        )}
      </div>

      {/* Footer */}
      <div className="navbar-notifications-footer">
        <Link
          to="/notificaciones"
          className="navbar-notifications-view-all"
          onClick={onClose}
        >
          <EyeIcon className="navbar-notifications-view-all-icon" />
          Ver todas las notificaciones
        </Link>
      </div>
    </div>
  );
};

export default NotificationsDropdown;