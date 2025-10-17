import React from 'react';

/**
 * Componente de ícono de crypto con fallback
 */
const CryptoIcon = ({ cripto, size = 32 }) => {
  const [imgError, setImgError] = React.useState(false);

  if (imgError || !cripto.iconUrl) {
    return (
      <div className="crypto-icon-fallback" style={{ width: size, height: size }}>
        {cripto.symbol.substring(0, 3)}
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
 * Barra horizontal de selección de criptomonedas con buscador
 */
const CryptoBar = ({
  criptomonedas,
  criptoSeleccionada,
  onCriptoSelect,
  busqueda,
  onBusquedaChange,
  maxVisible = 12,
}) => {
  return (
    <div className="cripto-bar">
      <div className="cripto-search">
        <input
          type="text"
          placeholder="Buscar criptomoneda..."
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
          className="search-input"
        />
      </div>
      <div className="cripto-list-horizontal">
        {criptomonedas.slice(0, maxVisible).map(cripto => (
          <div
            key={cripto.id}
            className={`cripto-item-horizontal ${criptoSeleccionada === cripto.id ? 'active' : ''}`}
            onClick={() => onCriptoSelect(cripto.id)}
          >
            <CryptoIcon cripto={cripto} size={24} />
            <span className="cripto-symbol">{cripto.symbol}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CryptoBar;