// src/components/features/TransferHistory.jsx
import { useState } from 'react';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import { formatDate, formatCryptoAmount, generateTransferPDF, getUniqueCryptos } from '../../utils/formatters';
import { toast } from 'react-hot-toast';

export default function TransferHistory({ transfers, loading, filters, setFilters }) {
  const uniqueCryptos = getUniqueCryptos(transfers);

  const handleDownloadReceipt = (transfer) => {
    generateTransferPDF(transfer);
    toast.success('Comprobante PDF descargado');
  };

  return (
    <div className="historial-section">
      <div className="historial-header">
        <h2 className="historial-title">Transferencias Enviadas</h2>

        {transfers.length > 0 && (
          <div className="historial-filters">
            <div className="search-box">
              <MagnifyingGlassIcon className="search-icon-small" />
              <input
                type="text"
                placeholder="Buscar por destinatario o crypto..."
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

      {loading ? (
        <div className="loading-historial">
          <ArrowPathIcon className="loading-icon spinning" />
          Cargando historial...
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
          <p className="empty-description">Intenta ajustar los filtros de búsqueda</p>
        </div>
      ) : (
        <div className="historial-table-wrapper">
          <table className="historial-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Destinatario</th>
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

                return (
                  <tr key={transfer.id}>
                    <td>{formatDate(transfer.created_at)}</td>
                    <td>{transfer.destinatario?.username || 'N/A'}</td>
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
                        {transfer.estado === 'pendiente' && 'Pendiente'}
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