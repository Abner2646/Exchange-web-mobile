import React from 'react';
import OfertaItem from './OfertaItem';

/**
 * Lista completa de ofertas P2P con headers de tabla 
 */
const OfertasList = ({
  ofertas,
  criptomonedas,
  tipoOperacion,
  criptoActual,
  getUsuarioData,
  onIniciarTransaccion,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="ofertas-main">
        <div className="loading-spinner">Cargando ofertas...</div>
      </div>
    );
  }

  return (
    <div className="ofertas-main">
      <div className="ofertas-header">
        <h2>
          {tipoOperacion === 'compra' ? 'Comprar' : 'Vender'} {criptoActual?.symbol}
        </h2>
        <div className="ofertas-controls">
          <span className="ofertas-count">
            {ofertas.length} oferta(s)
          </span>
          <select className="ordenar-select">
            <option>Precio</option>
          </select>
        </div>
      </div>

      <div className="ofertas-list">
        {/* Headers de la tabla */}
        <div className="tabla-header">
          <div className="col-anunciante">Anunciantes</div>
          <div className="col-precio">Precio</div>
          <div className="col-disponible">Disponible/Límite</div>
          <div className="col-pago">Pago</div>
          <div className="col-operacion">Operación</div>
        </div>

        {/* Filas de ofertas */}
        {ofertas.map(oferta => {
          const usuarioData = getUsuarioData(oferta.usuarioId);
          const cripto = criptomonedas.find(c => c.id === oferta.criptomonedaId);

          return (
            <OfertaItem
              key={oferta.id}
              oferta={oferta}
              cripto={cripto}
              usuarioData={usuarioData}
              tipoOperacion={tipoOperacion}
              onIniciarTransaccion={onIniciarTransaccion}
            />
          );
        })}
      </div>

      {/* Mensaje cuando no hay ofertas */}
      {ofertas.length === 0 && (
        <div className="sin-ofertas">
          <p>
            No se encontraron ofertas para {tipoOperacion === 'compra' ? 'comprar' : 'vender'} {criptoActual?.symbol}
          </p>
        </div>
      )}
    </div>
  );
};

export default OfertasList;