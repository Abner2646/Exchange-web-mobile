// src/components/features/UserOrders.jsx (web)
import { useState } from 'react';
import '../../styles/UserOrders.css';

const UserOrders = ({ orders, onCancel, loading }) => {
  const [filter, setFilter] = useState('open'); // 'open' | 'filled' | 'cancelled' | 'all'
  const [cancellingOrderId, setCancellingOrderId] = useState(null);

  // Filtrar órdenes por estado
  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    if (filter === 'open') return order.status === 'open' || order.status === 'partially_filled';
    return order.status === filter;
  });

  // Manejar cancelación
  const handleCancel = async (orderId) => {
    setCancellingOrderId(orderId);
    await onCancel(orderId);
    setCancellingOrderId(null);
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Formatear precio
  const formatPrice = (price, precision = 2) => {
    return parseFloat(price).toFixed(precision);
  };

  // Formatear cantidad
  const formatQuantity = (quantity, precision = 4) => {
    return parseFloat(quantity).toFixed(precision);
  };

  // Obtener badge de estado
  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'Pendiente', className: 'pending' },
      open: { label: 'Abierta', className: 'open' },
      partially_filled: { label: 'Parcial', className: 'partial' },
      filled: { label: 'Ejecutada', className: 'filled' },
      cancelled: { label: 'Cancelada', className: 'cancelled' },
      expired: { label: 'Expirada', className: 'expired' },
      rejected: { label: 'Rechazada', className: 'rejected' },
    };

    const statusInfo = statusMap[status] || { label: status, className: 'default' };

    return (
      <span className={`userorders-status-badge userorders-status-${statusInfo.className}`}>
        {statusInfo.label}
      </span>
    );
  };

  return (
    <div className="userorders-container">
      {/* Header */}
      <div className="userorders-header">
        <h3 className="userorders-title">Mis Órdenes</h3>
      </div>

      {/* Filters */}
      <div className="userorders-filters">
        <button
          className={`userorders-filter-btn ${filter === 'open' ? 'active' : ''}`}
          onClick={() => setFilter('open')}
        >
          Abiertas
        </button>
        <button
          className={`userorders-filter-btn ${filter === 'filled' ? 'active' : ''}`}
          onClick={() => setFilter('filled')}
        >
          Ejecutadas
        </button>
        <button
          className={`userorders-filter-btn ${filter === 'cancelled' ? 'active' : ''}`}
          onClick={() => setFilter('cancelled')}
        >
          Canceladas
        </button>
        <button
          className={`userorders-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Todas
        </button>
      </div>

      {/* Orders list */}
      <div className="userorders-list">
        {loading ? (
          <div className="userorders-loading">
            <div className="userorders-spinner"></div>
            <p>Cargando órdenes...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="userorders-empty">
            <p>No tienes órdenes {filter !== 'all' ? filter === 'open' ? 'abiertas' : filter : ''}</p>
          </div>
        ) : (
          <div className="userorders-table">
            {/* Table header */}
            <div className="userorders-table-header">
              <div className="userorders-table-cell">Fecha</div>
              <div className="userorders-table-cell">Par</div>
              <div className="userorders-table-cell">Tipo</div>
              <div className="userorders-table-cell">Lado</div>
              <div className="userorders-table-cell">Precio</div>
              <div className="userorders-table-cell">Cantidad</div>
              <div className="userorders-table-cell">Ejecutado</div>
              <div className="userorders-table-cell">Estado</div>
              <div className="userorders-table-cell">Acciones</div>
            </div>

            {/* Table rows */}
            {filteredOrders.map(order => {
              const canCancel = order.status === 'open' || order.status === 'partially_filled';
              const isCancelling = cancellingOrderId === order.id;

              return (
                <div key={order.id} className="userorders-table-row">
                  <div className="userorders-table-cell">
                    {formatDate(order.createdAt)}
                  </div>
                  
                  <div className="userorders-table-cell">
                    <span className="userorders-pair">
                      {order.tradingPair?.symbol}
                    </span>
                  </div>
                  
                  <div className="userorders-table-cell">
                    <span className="userorders-type">{order.orderType}</span>
                  </div>
                  
                  <div className="userorders-table-cell">
                    <span className={`userorders-side userorders-side-${order.side}`}>
                      {order.side === 'buy' ? 'Compra' : 'Venta'}
                    </span>
                  </div>
                  
                  <div className="userorders-table-cell">
                    {order.price ? formatPrice(order.price, order.tradingPair?.pricePrecision) : 'Market'}
                  </div>
                  
                  <div className="userorders-table-cell">
                    {formatQuantity(order.quantity, order.tradingPair?.quantityPrecision)}
                  </div>
                  
                  <div className="userorders-table-cell">
                    {formatQuantity(order.quantityFilled, order.tradingPair?.quantityPrecision)}
                    <span className="userorders-percentage">
                      ({((parseFloat(order.quantityFilled) / parseFloat(order.quantity)) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  
                  <div className="userorders-table-cell">
                    {getStatusBadge(order.status)}
                  </div>
                  
                  <div className="userorders-table-cell">
                    {canCancel && (
                      <button
                        className="userorders-cancel-btn"
                        onClick={() => handleCancel(order.id)}
                        disabled={isCancelling}
                      >
                        {isCancelling ? (
                          <>
                            <span className="userorders-cancel-spinner"></span>
                            Cancelando...
                          </>
                        ) : (
                          'Cancelar'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserOrders;