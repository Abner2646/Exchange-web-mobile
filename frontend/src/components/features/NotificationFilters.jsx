// src/components/features/NotificationFilters.jsx

const NOTIFICATION_TYPES = [
  { value: 'todas', label: 'Todas' },
  { value: 'deposito', label: 'Depósitos' },
  { value: 'seguridad', label: 'Seguridad' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'transaccion', label: 'Transacciones' },
  { value: 'p2p', label: 'P2P' },
  { value: 'swap', label: 'Swap' },
];

const NotificationFilters = ({ selectedType, onTypeChange }) => {
  return (
    <div className="notif-filters">
      {NOTIFICATION_TYPES.map((type) => (
        <button
          key={type.value}
          className={`notif-filter-chip ${selectedType === type.value ? 'active' : ''}`}
          onClick={() => onTypeChange(type.value)}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
};

export default NotificationFilters;