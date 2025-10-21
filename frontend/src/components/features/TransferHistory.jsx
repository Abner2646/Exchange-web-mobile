// src/components/features/TransferHistory.jsx
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import {
  formatDate,
  formatCryptoAmount,
  generateTransferPDF,
  getUniqueCryptos,
} from '../../utils/formatters';
import transferService from '../../services/transferService';
import { toast } from 'react-hot-toast';

export default function TransferHistory({ transfers, loading, filters, setFilters }) {
  const { user } = useAuth();
  const uniqueCryptos = getUniqueCryptos(transfers);

  const handleDownloadReceipt = (transfer) => {
    generateTransferPDF(transfer);
    toast.success('Comprobante PDF descargado');
  };

  const handleTabChange = (type) => {
    setFilters({ ...filters, type });
  };

  const getTransferType = (transfer) => {
    return transferService.getTransferType(transfer, user?.id);
  };

  const getUserText = (transfer) => {
    const type = getTransferType(transfer);
    if (type === 'sent') {
      return `Enviado a ${transfer.destinatario?.username || 'N/A'}`;
    } else {
      return `Recibido de ${transfer.remitente?.username || 'N/A'}`;
    }
  };

  return (
    <div className="historial-section">
      <div className="historial-header">
        <h2 className="historial-title">Historial de Transferencias</h2>

        {/* ⭐ TABS SIN CONTADORES - Solo HeroIcons */}
        <div className="historial-tabs">
          <button
            className={`historial-tab ${filters.type === 'all' ? 'historial-tab-active' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            <QueueListIcon className="tab-icon" />
            <span className="tab-label">Todas</span>
          </button>

          <button
            className={`historial-tab ${filters.type === 'sent' ? 'historial-tab-active' : ''}`}
            onClick={() => handleTabChange('sent')}
          >
            <ArrowUpIcon className="tab-icon" />
            <span className="tab-label">Enviadas</span>
          </button>

          <button
            className={`historial-tab ${
              filters.type === 'received' ? 'historial-tab-active' : ''
            }`}
            onClick={() => handleTabChange('received')}
          >
            <ArrowDownIcon className="tab-icon" />
            <span className="tab-label">Recibidas</span>
          </button>
        </div>

        {/* Filtros */}
        {transfers.length > 0 && (
          <div className="historial-filters">
            <div className="search-box">
              <MagnifyingGlassIcon className="search-icon-small" />
              <input
                type="text"
                placeholder="Buscar por usuario o crypto..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="search-input"
              />
            </div>

            <select
              className="filter-select"
              value={filters.crypto}
              onChange={(e) => setFilters({ ...filters, crypto: e.target.value })}
            >
              <option value="all">Todas las cryptos</option>
              {uniqueCryptos.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>

            <select
              className="filter-select"
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
            >
              <option value="all">Todo el tiempo</option>
              <option value="week">Última semana</option>
              <option value="month">Último mes</option>
            </select>
          </div>
        )}
      </div>

      {/* Skeleton Loader */}
      {loading ? (
        <div className="skeleton-table">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="skeleton-row">
              <div className="skeleton-cell skeleton-pulse"></div>
              <div className="skeleton-cell skeleton-pulse"></div>
              <div className="skeleton-cell skeleton-pulse"></div>
              <div className="skeleton-cell skeleton-pulse"></div>
              <div className="skeleton-cell skeleton-pulse"></div>
              <div className="skeleton-cell skeleton-pulse"></div>
            </div>
          ))}
        </div>
      ) : transfers.length === 0 ? (
        <div className="empty-historial">
          <svg
            className="empty-illustration"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="2" opacity="0.2" />
            <path
              d="M70 100L90 120L130 80"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.3"
            />
          </svg>
          <h3 className="empty-title">No se encontraron resultados</h3>
          <p className="empty-description">
            {filters.type === 'sent' && 'No tienes transferencias enviadas'}
            {filters.type === 'received' && 'No tienes transferencias recibidas'}
            {filters.type === 'all' && 'Intenta ajustar los filtros de búsqueda'}
          </p>
        </div>
      ) : (
        <div className="historial-table-wrapper">
          <table className="historial-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Criptomoneda</th>
                <th>Cantidad</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((transfer) => {
                const cryptoIconUrl = transfer.criptomonedaTransferencia?.symbol
                  ? `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${transfer.criptomonedaTransferencia.symbol.toLowerCase()}.svg`
                  : '/placeholder.svg';

                const transferType = getTransferType(transfer);
                const isSent = transferType === 'sent';

                return (
                  <tr
                    key={transfer.id}
                    className={`historial-row ${
                      isSent ? 'historial-row-sent' : 'historial-row-received'
                    }`}
                  >
                    <td>
                      <div className="transfer-type-indicator">
                        {isSent ? (
                          <ArrowUpIcon className="type-icon type-icon-sent" />
                        ) : (
                          <ArrowDownIcon className="type-icon type-icon-received" />
                        )}
                      </div>
                    </td>

                    <td>{formatDate(transfer.created_at)}</td>
                    <td>{getUserText(transfer)}</td>

                    <td>
                      <div className="crypto-cell">
                        <img
                          src={cryptoIconUrl}
                          alt={transfer.criptomonedaTransferencia?.symbol}
                          className="crypto-icon-small"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="crypto-icon-fallback-small" style={{ display: 'none' }}>
                          {transfer.criptomonedaTransferencia?.symbol?.slice(0, 3)}
                        </div>
                        {transfer.criptomonedaTransferencia?.symbol}
                      </div>
                    </td>

                    <td>{formatCryptoAmount(transfer.cantidad)}</td>

                    <td>
                      <span className={`status-badge status-${transfer.estado}`}>
                        {transfer.estado === 'completada' && 'Completada'}
                        {transfer.estado === 'cancelada' && 'Cancelada'}
                      </span>
                    </td>

                    <td>
                      <button
                        className="action-button"
                        onClick={() => handleDownloadReceipt(transfer)}
                        title="Descargar comprobante"
                      >
                        <ArrowDownTrayIcon className="action-icon" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}