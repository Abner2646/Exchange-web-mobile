// src/components/features/CryptoSelector.jsx
import { useState, useRef, useEffect } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function CryptoSelector({
  criptomonedas = [], // ⭐ Valor por defecto
  criptoSeleccionada,
  onSelect,
}) {
  const [searchCrypto, setSearchCrypto] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  // Filtrar criptomonedas con protección
  const criptosFiltradas = (criptomonedas || []).filter(
    (crypto) =>
      crypto.nombre.toLowerCase().includes(searchCrypto.toLowerCase()) ||
      crypto.symbol.toLowerCase().includes(searchCrypto.toLowerCase())
  );

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      searchRef.current?.focus();
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleSelect = (crypto) => {
    onSelect(crypto);
    setShowDropdown(false);
    setSearchCrypto('');
    console.log('✅ Crypto seleccionada:', crypto.symbol);
  };

  return (
    <div className="crypto-selector" ref={dropdownRef}>
      <button
        type="button"
        className="crypto-selector-button"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        {criptoSeleccionada ? (
          <div className="crypto-selected">
            <img
              src={criptoSeleccionada.iconUrl || '/placeholder.svg'}
              alt={criptoSeleccionada.symbol}
              className="crypto-icon"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="crypto-icon-fallback" style={{ display: 'none' }}>
              {criptoSeleccionada.symbol.slice(0, 3)}
            </div>
            <div className="crypto-info">
              <span className="crypto-symbol">{criptoSeleccionada.symbol}</span>
              <span className="crypto-name">{criptoSeleccionada.nombre}</span>
            </div>
          </div>
        ) : (
          <span className="crypto-placeholder">Seleccionar criptomoneda</span>
        )}
      </button>

      {showDropdown && (
        <div className="crypto-dropdown">
          <div className="crypto-search">
            <MagnifyingGlassIcon className="search-icon" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar..."
              value={searchCrypto}
              onChange={(e) => setSearchCrypto(e.target.value)}
              className="crypto-search-input"
            />
          </div>
          <div className="crypto-list">
            {criptosFiltradas.length > 0 ? (
              criptosFiltradas.map((crypto) => (
                <button
                  key={crypto.id}
                  type="button"
                  className="crypto-item"
                  onClick={() => handleSelect(crypto)}
                >
                  <img
                    src={crypto.iconUrl || '/placeholder.svg'}
                    alt={crypto.symbol}
                    className="crypto-icon-small"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div
                    className="crypto-icon-fallback-small"
                    style={{ display: 'none' }}
                  >
                    {crypto.symbol.slice(0, 3)}
                  </div>
                  <span className="crypto-item-symbol">{crypto.symbol}</span>
                </button>
              ))
            ) : (
              <div className="crypto-list-empty">
                {criptomonedas.length === 0 ? 'Cargando...' : 'No se encontraron resultados'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}