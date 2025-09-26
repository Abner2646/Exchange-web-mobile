import React, { useState, useEffect } from 'react';
import '../styles/Swap.css';

const Swap = () => {
  // Estados principales
  const [fromCrypto, setFromCrypto] = useState(null);
  const [toCrypto, setToCrypto] = useState(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Estados para datos
  const [cryptos, setCryptos] = useState([]);
  const [balances, setBalances] = useState([]);
  const [exchangeData, setExchangeData] = useState(null);
  
  // Dropdown states
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  // Datos simulados para desarrollo
  const mockCryptos = [
    { id: '1', symbol: 'USDT', nombre: 'Tether USD', activa: true },
    { id: '2', symbol: 'BTC', nombre: 'Bitcoin', activa: true },
    { id: '3', symbol: 'ETH', nombre: 'Ethereum', activa: true },
    { id: '4', symbol: 'BNB', nombre: 'Binance Coin', activa: true }
  ];

  const mockBalances = [
    { criptomonedaId: '1', symbol: 'USDT', disponible: '323.12663199', bloqueado: '0' },
    { criptomonedaId: '2', symbol: 'BTC', disponible: '0.00245678', bloqueado: '0' },
    { criptomonedaId: '3', symbol: 'ETH', disponible: '1.45678901', bloqueado: '0' },
    { criptomonedaId: '4', symbol: 'BNB', disponible: '12.34567890', bloqueado: '0' }
  ];

  useEffect(() => {
    // Simular carga de datos iniciales
    setCryptos(mockCryptos);
    setBalances(mockBalances);
    
    // Pre-seleccionar USDT y BTC
    setFromCrypto(mockCryptos[0]);
    setToCrypto(mockCryptos[1]);
  }, []);

  // Obtener balance de una criptomoneda
  const getBalance = (symbol) => {
    const balance = balances.find(b => b.symbol === symbol);
    return balance ? parseFloat(balance.disponible) : 0;
  };

  // Alternar criptomonedas
  const handleSwapCryptos = () => {
    setFromCrypto(toCrypto);
    setToCrypto(fromCrypto);
    setFromAmount('');
    setToAmount('');
    setExchangeRate(null);
  };

  // Calcular intercambio simulado
  const calculateExchange = (amount, from, to) => {
    if (!amount || !from || !to) return;
    
    // Simulación de tasas de cambio
    const rates = {
      'USDT-BTC': 0.000009047,
      'BTC-USDT': 110537.9,
      'USDT-ETH': 0.000243,
      'ETH-USDT': 4115.23,
      'BTC-ETH': 26.85,
      'ETH-BTC': 0.0372
    };
    
    const pair = `${from.symbol}-${to.symbol}`;
    const rate = rates[pair] || 1;
    const result = parseFloat(amount) * rate;
    
    setToAmount(result.toFixed(8));
    setExchangeRate(rate);
  };

  // Manejar cambio de cantidad origen
  const handleFromAmountChange = (e) => {
    const value = e.target.value;
    setFromAmount(value);
    
    if (value && fromCrypto && toCrypto) {
      calculateExchange(value, fromCrypto, toCrypto);
    } else {
      setToAmount('');
      setExchangeRate(null);
    }
  };

  // Manejar confirmación
  const handleConfirm = () => {
    if (!fromAmount || !fromCrypto || !toCrypto) return;
    
    setExchangeData({
      from: { symbol: fromCrypto.symbol, amount: fromAmount },
      to: { symbol: toCrypto.symbol, amount: toAmount },
      rate: exchangeRate,
      commission: '0'
    });
    
    setShowConfirmModal(true);
  };

  // Ejecutar intercambio
  const executeSwap = async () => {
    setLoading(true);
    try {
      // Aquí iría la llamada real a la API
      console.log('Ejecutando swap:', exchangeData);
      
      // Simular delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setShowConfirmModal(false);
      setFromAmount('');
      setToAmount('');
      setExchangeRate(null);
      
      // Aquí actualizarías los balances
    } catch (error) {
      console.error('Error en swap:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="swap-container">
      {/* Header */}
      <header className="swap-header">
        <h1 className="swap-title">
          Intercambiar Criptomonedas
        </h1>
        <p className="swap-subtitle">
          Precio inmediato | Precio garantizado | Cualquier par
        </p>
      </header>

      {/* Tipo de orden */}
      <div className="order-types">
        {['Instantáneo', 'Recurrente', 'Límite'].map((type, index) => (
          <button
            key={type}
            className={`order-type-btn ${index === 0 ? 'active' : ''}`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Contenedor principal del swap */}
      <div className="swap-main-container">
        {/* Campo "De" */}
        <div className="swap-field">
          <div className="swap-field-header">
            <span className="field-label">De</span>
            <span className="balance-text">
              Saldo disponible {fromCrypto ? getBalance(fromCrypto.symbol).toFixed(8) : '0'} {fromCrypto?.symbol}
            </span>
          </div>
          
          <div className="swap-input-container">
            {/* Selector de criptomoneda origen */}
            <div className="crypto-selector">
              <button
                className="crypto-select-btn"
                onClick={() => setShowFromDropdown(!showFromDropdown)}
              >
                <div className={`crypto-icon ${fromCrypto?.symbol?.toLowerCase()}`}>
                  {fromCrypto?.symbol?.charAt(0)}
                </div>
                <span className="crypto-symbol">
                  {fromCrypto?.symbol || 'Seleccionar'}
                </span>
                <span className="dropdown-arrow">▼</span>
              </button>

              {/* Dropdown origen */}
              {showFromDropdown && (
                <div className="crypto-dropdown">
                  {cryptos.map(crypto => (
                    <button
                      key={crypto.id}
                      className="crypto-option"
                      onClick={() => {
                        setFromCrypto(crypto);
                        setShowFromDropdown(false);
                        setFromAmount('');
                        setToAmount('');
                      }}
                    >
                      <div className={`crypto-icon ${crypto.symbol.toLowerCase()}`}>
                        {crypto.symbol.charAt(0)}
                      </div>
                      <div className="crypto-info">
                        <div className="crypto-symbol">{crypto.symbol}</div>
                        <div className="crypto-name">{crypto.nombre}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input de cantidad */}
            <input
              type="number"
              value={fromAmount}
              onChange={handleFromAmountChange}
              placeholder="0"
              className="amount-input"
            />

            {/* Botón Max */}
            <button 
              className="max-btn"
              onClick={() => {
                if (fromCrypto) {
                  const maxBalance = getBalance(fromCrypto.symbol);
                  setFromAmount(maxBalance.toString());
                  if (toCrypto) {
                    calculateExchange(maxBalance.toString(), fromCrypto, toCrypto);
                  }
                }
              }}
            >
              Max
            </button>
          </div>
        </div>

        {/* Botón intercambiar */}
        <div className="swap-button-container">
          <button className="swap-currencies-btn" onClick={handleSwapCryptos}>
            <span className="swap-icon">⇅</span>
          </button>
        </div>

        {/* Campo "A" */}
        <div className="swap-field">
          <div className="swap-field-header">
            <span className="field-label">A</span>
            <span className="balance-text">
              Saldo disponible {toCrypto ? getBalance(toCrypto.symbol).toFixed(8) : '0'} {toCrypto?.symbol}
            </span>
          </div>
          
          <div className="swap-input-container">
            {/* Selector de criptomoneda destino */}
            <div className="crypto-selector">
              <button
                className="crypto-select-btn"
                onClick={() => setShowToDropdown(!showToDropdown)}
              >
                <div className={`crypto-icon ${toCrypto?.symbol?.toLowerCase()}`}>
                  {toCrypto?.symbol?.charAt(0)}
                </div>
                <span className="crypto-symbol">
                  {toCrypto?.symbol || 'Seleccionar'}
                </span>
                <span className="dropdown-arrow">▼</span>
              </button>

              {/* Dropdown destino */}
              {showToDropdown && (
                <div className="crypto-dropdown">
                  {cryptos.map(crypto => (
                    <button
                      key={crypto.id}
                      className="crypto-option"
                      onClick={() => {
                        setToCrypto(crypto);
                        setShowToDropdown(false);
                        setFromAmount('');
                        setToAmount('');
                      }}
                    >
                      <div className={`crypto-icon ${crypto.symbol.toLowerCase()}`}>
                        {crypto.symbol.charAt(0)}
                      </div>
                      <div className="crypto-info">
                        <div className="crypto-symbol">{crypto.symbol}</div>
                        <div className="crypto-name">{crypto.nombre}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Output de cantidad */}
            <div className="amount-output">
              {toAmount || '0.00000000'}
            </div>
          </div>
        </div>

        {/* Información de tasa */}
        {exchangeRate && (
          <div className="exchange-info">
            <span className="exchange-rate">
              Tasa: 1 {fromCrypto?.symbol} ≈ {exchangeRate.toFixed(8)} {toCrypto?.symbol}
            </span>
          </div>
        )}

        {/* Botón confirmar */}
        <button 
          className="btn-primary swap-confirm-btn"
          onClick={handleConfirm}
          disabled={!fromAmount || !fromCrypto || !toCrypto}
        >
          Vista previa
        </button>
      </div>

      {/* Modal de confirmación */}
      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="modal-container">
            <div className="modal-header">
              <h2 className="modal-title">Confirmar</h2>
              <button 
                className="modal-close-btn"
                onClick={() => setShowConfirmModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              {/* Iconos de conversión */}
              <div className="conversion-display">
                <div className="conversion-from">
                  <div className={`crypto-icon large ${exchangeData?.from.symbol.toLowerCase()}`}>
                    {exchangeData?.from.symbol.charAt(0)}
                  </div>
                  <span className="conversion-label">De</span>
                  <span className="conversion-amount">
                    {exchangeData?.from.amount} {exchangeData?.from.symbol}
                  </span>
                </div>

                <div className="conversion-arrow">→</div>

                <div className="conversion-to">
                  <div className={`crypto-icon large ${exchangeData?.to.symbol.toLowerCase()}`}>
                    {exchangeData?.to.symbol.charAt(0)}
                  </div>
                  <span className="conversion-label">A</span>
                  <span className="conversion-amount">
                    {exchangeData?.to.amount} {exchangeData?.to.symbol}
                  </span>
                </div>
              </div>

              {/* Detalles */}
              <div className="modal-details">
                <div className="detail-row">
                  <span className="detail-label">Tasa</span>
                  <span className="detail-value">
                    1 {exchangeData?.from.symbol} ≈ {exchangeData?.rate.toFixed(8)} {exchangeData?.to.symbol}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Método de pago</span>
                  <span className="detail-value">Billetera spot + Billetera de fondos</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Comisiones de transacción</span>
                  <span className="detail-value">{exchangeData?.commission} {exchangeData?.to.symbol}</span>
                </div>
              </div>

              {/* Contador de actualización */}
              <div className="refresh-info">
                <span>Exchange rate will refresh in 🔄 1s</span>
              </div>

              {/* Botón convertir */}
              <button 
                className="btn-primary modal-convert-btn"
                onClick={executeSwap}
                disabled={loading}
              >
                {loading ? 'Convirtiendo...' : 'Convertir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Swap;