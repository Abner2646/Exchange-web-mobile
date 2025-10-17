// src/components/features/NotificationEmpty.jsx
import { BellIcon } from '@heroicons/react/24/outline';

const NotificationEmpty = ({ selectedType }) => {
  return (
    <div className="notif-empty">
      <BellIcon className="notif-empty-icon" />
      <p className="notif-empty-text">No hay notificaciones</p>
      <p className="notif-empty-subtext">
        {selectedType !== 'todas'
          ? 'Intenta cambiar el filtro'
          : 'Cuando recibas notificaciones aparecerán aquí'}
      </p>
    </div>
  );
};

export default NotificationEmpty;