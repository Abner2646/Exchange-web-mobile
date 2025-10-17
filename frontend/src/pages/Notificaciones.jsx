// src/pages/Notificaciones.jsx
import { useState, useEffect } from 'react';
import { CheckIcon, FunnelIcon } from '@heroicons/react/24/outline';
import useNotifications from '../hooks/useNotifications';
import NotificationItem from '../components/features/NotificationItem';
import NotificationFilters from '../components/features/NotificationFilters';
import NotificationEmpty from '../components/features/NotificationEmpty';
import '../styles/Notificaciones.css';

const Notificaciones = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedType, setSelectedType] = useState('todas');
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 10;

  // Hook con React Query
  const {
    notifications,
    unreadCount,
    isLoading,
    markAllAsRead,
    toggleRead,
    isMarkingAllAsRead,
  } = useNotifications();

  console.log('[Notificaciones] Component state:', {
    notificationsCount: notifications.length,
    unreadCount,
    isLoading,
    currentPage,
    selectedType,
  });

  // Filtrar notificaciones por tipo
  const filteredNotifications =
    selectedType === 'todas'
      ? notifications
      : notifications.filter((n) => n.tipo === selectedType);

  console.log('[Notificaciones] Filtered notifications:', filteredNotifications.length);

  // Paginación
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentNotifications = filteredNotifications.slice(startIndex, endIndex);

  // Resetear página al cambiar filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedType]);

  const handleMarkAllAsRead = () => {
    console.log('[Notificaciones] Mark all as read clicked');
    markAllAsRead();
  };

  const handleToggleRead = (notification) => {
    console.log('[Notificaciones] Toggle read for notification:', notification.id);
    toggleRead(notification);
  };

  const handleTypeChange = (type) => {
    console.log('[Notificaciones] Filter changed to:', type);
    setSelectedType(type);
  };

  return (
    <div className="notif-container">
      {/* Header */}
      <div className="notif-header">
        <div className="notif-header-left">
          <h1 className="notif-title">Notificaciones</h1>
          {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
        </div>

        <div className="notif-header-actions">
          <button className="notif-filter-btn" onClick={() => setShowFilters(!showFilters)}>
            <FunnelIcon className="notif-btn-icon" />
            Filtrar
          </button>

          <button
            className="notif-mark-all-btn"
            onClick={handleMarkAllAsRead}
            disabled={unreadCount === 0 || isMarkingAllAsRead}
          >
            <CheckIcon className="notif-btn-icon" />
            Marcar todas como leídas
          </button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <NotificationFilters selectedType={selectedType} onTypeChange={handleTypeChange} />
      )}

      {/* Lista de notificaciones */}
      <div className="notif-list">
        {isLoading ? (
          // Skeleton loaders
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="notif-item skeleton">
              <div className="notif-item-icon skeleton-icon"></div>
              <div className="notif-item-content">
                <div className="skeleton-title"></div>
                <div className="skeleton-message"></div>
              </div>
              <div className="skeleton-time"></div>
            </div>
          ))
        ) : currentNotifications.length === 0 ? (
          // Empty state
          <NotificationEmpty selectedType={selectedType} />
        ) : (
          // Lista de notificaciones
          currentNotifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onToggleRead={handleToggleRead}
            />
          ))
        )}
      </div>

      {/* Paginación */}
      {!isLoading && filteredNotifications.length > itemsPerPage && (
        <div className="notif-pagination">
          <button
            className="notif-pagination-btn"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </button>

          <span className="notif-pagination-info">
            Página {currentPage} de {totalPages}
          </span>

          <button
            className="notif-pagination-btn"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default Notificaciones;