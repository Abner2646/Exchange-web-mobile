import React, { useState } from 'react';
import { formatearPrecio, calcularRangoFiat } from '../../utils/p2pHelpers';

/**
 * Componente de ícono de crypto con fallback
 */
const CryptoIcon = ({ cripto, size = 32 }) => {
  const [imgError, setImgError] = useState(false);

  if (imgError || !cripto?.iconUrl) {
    return (
      <div className="crypto-icon-fallback" style={{ width: size, height: size }}>
        {cripto?.symbol?.substring(0, 3) || '?'}
      </div>
    );
  }

  return (
    <img 
      src={cripto.iconUrl} 
      alt={cripto.symbol}
      className="crypto-icon"
      style={{ width: size, height: size }}
      onError={() => setImgError(true)}
    />
  );
};

/**
 * Componente individual de oferta P2P
 */
const OfertaItem = ({
  oferta,
  cripto,
  usuarioData,
  tipoOperacion,
  onIniciarTransaccion,
}) => {
  const { min, max } = calcularRangoFiat(
    oferta.cantidadMin,
    oferta.cantidadMax,
    oferta.precioUnitario
  );

  return (
    <div className="oferta-item">
      {/* Columna Anunciante */}
      <div className="col-anunciante">
        <div className="anunciante-info">
          <div className="anunciante-avatar">
            {usuarioData.username.charAt(0).toUpperCase()}
          </div>
          <div className="anunciante-detalles">
            <div className="anunciante-nombre">
              {usuarioData.username}
              {usuarioData.kycVerificado && (
                <span className="verificado-badge">✓</span>
              )}
              {usuarioData.esPropio && (
                <span className="badge-propio">Tú</span>
              )}
            </div>
            <div className="anunciante-stats">
              <span className="stat-item">{usuarioData.totalValoraciones} órdenes</span>
              <span className="stat-separator">|</span>
              <span className="stat-item stat-positivo">
                {usuarioData.reputacionPromedio 
                  ? `${(usuarioData.reputacionPromedio * 20).toFixed(0)}%` 
                  : '0%'} Completado
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Columna Precio */}
      <div className="col-precio">
        <div className="precio-valor">
          {formatearPrecio(oferta.precioUnitario, 2)}
        </div>
        <div className="precio-moneda">{oferta.monedaFiat}</div>
      </div>

      {/* Columna Disponible/Límite */}
      <div className="col-disponible">
        <div className="disponible-cripto">
          {cripto && <CryptoIcon cripto={cripto} size={16} />}
          <span>
            {formatearPrecio(oferta.cantidadMax, 8)} {cripto?.symbol}
          </span>
        </div>
        <div className="disponible-rango">
          {formatearPrecio(min, 0)} - {formatearPrecio(max, 0)} {oferta.monedaFiat}
        </div>
      </div>

      {/* Columna Métodos de Pago */}
      <div className="col-pago">
        {oferta.metodosPago?.slice(0, 3).map(metodo => (
          <div key={metodo.id} className="pago-metodo">
            {metodo.nombre}
          </div>
        ))}
        {oferta.metodosPago?.length > 3 && (
          <div className="pago-metodo-mas">
            +{oferta.metodosPago.length - 3}
          </div>
        )}
      </div>

      {/* Columna Operación */}
      <div className="col-operacion">
        <button
          className={`btn-operacion ${tipoOperacion}`}
          onClick={() => onIniciarTransaccion(oferta.id)}
          disabled={usuarioData.esPropio}
        >
          {tipoOperacion === 'compra' ? 'Comprar' : 'Vender'} {cripto?.symbol}
        </button>
      </div>
    </div>
  );
};

export default OfertaItem;