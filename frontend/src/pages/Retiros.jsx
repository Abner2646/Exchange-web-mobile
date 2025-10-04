import React, { useState, useEffect } from 'react';
import '../styles/withdrawal.css';

const Retiros = () => {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  
  const [criptomonedas, setCriptomonedas] = useState([]);
  const [balances, setBalances] = useState([]);
  
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [withdrawalType, setWithdrawalType] = useState('address');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [amount, setAmount] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [addressError, setAddressError] = useState('');

  const getToken = () => localStorage.getItem('token');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      const token = getToken();
      
      if (!token) {
        setError('No hay sesion activa. Por favor, inicia sesion.');
        setLoadingData(false);
        return;
      }

      const cryptoRes = await fetch('http://localhost:3001/api/criptomoneda/public/active');
      
      if (!cryptoRes.ok) {
        throw new Error('Error cargando criptomonedas');
      }

      const cryptoData = await cryptoRes.json();
      console.log('Respuesta API criptomonedas:', cryptoData);
      
      let cryptoArray = [];
      if (Array.isArray(cryptoData)) {
        cryptoArray = cryptoData;
      } else if (cryptoData && Array.isArray(cryptoData.data)) {
        cryptoArray = cryptoData.data;
      } else if (cryptoData && Array.isArray(cryptoData.criptomonedas)) {
        cryptoArray = cryptoData.criptomonedas;
      } else {
        console.error('Formato de respuesta inesperado:', cryptoData);
        cryptoArray = [];
      }
      
      setCriptomonedas(cryptoArray);

      const balanceRes = await fetch('http://localhost:3001/api/balances/my/balances', {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        console.log('Respuesta API balances:', balanceData);
        
        if (Array.isArray(balanceData)) {
          setBalances(balanceData);
        } else if (balanceData && Array.isArray(balanceData.data)) {
          setBalances(balanceData.data);
        } else {
          setBalances([]);
        }
      } else {
        console.error('Error cargando balances');
        setBalances([]);
      }

      if (cryptoArray.length > 0) {
        setSelectedCrypto(cryptoArray[0]);
      }

    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('Error al cargar datos. Por favor, recarga la pagina.');
      setCriptomonedas([]);
      setBalances([]);
    } finally {
      setLoadingData(false);
    }
  };

  const getSelectedBalance = () => {
    if (!selectedCrypto) return { disponible: 0, bloqueado: 0, total: 0 };
    
    const balance = balances.find(b => 
      b.criptomonedaId === selectedCrypto.id
    );

    if (!balance) {
      console.log('No se encontro balance para:', selectedCrypto.id);
      console.log('Balances disponibles:', balances);
      return { disponible: 0, bloqueado: 0, total: 0 };
    }

    const disponible = parseFloat(balance.balanceDisponible) || 0;
    const bloqueado = parseFloat(balance.balanceBloqueado) || 0;

    return {
      disponible: disponible,
      bloqueado: bloqueado,
      total: disponible + bloqueado
    };
  };

  const validateAddress = (address) => {
    if (!address) {
      setAddressError('La direccion es requerida');
      return false;
    }

    if (address.length < 26) {
      setAddressError('Direccion demasiado corta');
      return false;
    }

    if (selectedCrypto && (selectedCrypto.red.toLowerCase() === 'ethereum' || 
        selectedCrypto.red.toLowerCase() === 'bsc')) {
      if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
        setAddressError('Direccion Ethereum invalida');
        return false;
      }
    }

    setAddressError('');
    return true;
  };

  const handleAmountChange = (value) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
      setError('');
    }
  };

  const setMaxAmount = () => {
    const balance = getSelectedBalance();
    setAmount(balance.disponible.toString());
  };

  const validateForm = () => {
    const balance = getSelectedBalance();
    const numAmount = parseFloat(amount);

    if (!selectedCrypto) {
      setError('Selecciona una criptomoneda');
      return false;
    }

    if (!destinationAddress) {
      setError('Ingresa una direccion de destino');
      return false;
    }

    if (!validateAddress(destinationAddress)) {
      return false;
    }

    if (!amount || numAmount <= 0) {
      setError('Ingresa una cantidad valida');
      return false;
    }

    if (numAmount > balance.disponible) {
      setError('Cantidad excede balance disponible');
      return false;
    }

    if (numAmount < 0.00000001) {
      setError('Cantidad por debajo del minimo permitido');
      return false;
    }

    return true;
  };

  const handleWithdraw = async () => {
    try {
      setError('');
      setSuccess('');

      if (!validateForm()) {
        return;
      }

      setLoading(true);
      const token = getToken();

      const response = await fetch('http://localhost:3001/api/transactions/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          criptomonedaId: selectedCrypto.id,
          cantidad: parseFloat(amount),
          direccionDestino: destinationAddress
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al procesar retiro');
      }

      setSuccess('Retiro creado exitosamente. Sera procesado en breve.');
      
      setDestinationAddress('');
      setAmount('');
      
      setTimeout(() => {
        loadInitialData();
      }, 2000);

    } catch (err) {
      console.error('Error en retiro:', err);
      setError(err.message || 'Error al procesar el retiro');
    } finally {
      setLoading(false);
    }
  };

  const balance = getSelectedBalance();

  if (loadingData) {
    return (
      <div className="withdrawal-container">
        <div className="withdrawal-loading">
          <div className="loading-spinner"></div>
          <p>Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="withdrawal-container">
      <div className="withdrawal-wrapper">
        <header className="withdrawal-header">
          <div>
            <h1>Retirar Criptomonedas</h1>
            <p className="withdrawal-subtitle">
              Envia tus criptomonedas a una direccion externa de forma segura
            </p>
          </div>
        </header>

        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">&#9888;</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <span className="alert-icon">&#10003;</span>
            <span>{success}</span>
          </div>
        )}

        <div className="withdrawal-form">
          <div className="form-step">
            <div className="step-header">
              <span className="step-number">1</span>
              <h3>Seleccionar moneda</h3>
            </div>
            
            <div className="form-group">
              <label>Criptomoneda</label>
              <select
                className="form-select"
                value={selectedCrypto ? selectedCrypto.id : ''}
                onChange={(e) => {
                  const crypto = criptomonedas.find(c => c.id === e.target.value);
                  setSelectedCrypto(crypto);
                  setDestinationAddress('');
                  setAmount('');
                  setError('');
                }}
              >
                {criptomonedas.map(crypto => (
                  <option key={crypto.id} value={crypto.id}>
                    {crypto.symbol} - {crypto.nombre}
                  </option>
                ))}
              </select>
            </div>

            {selectedCrypto && (
              <div className="crypto-info">
                <div className="crypto-info-row">
                  <span>Red:</span>
                  <span className="crypto-network">{selectedCrypto.red}</span>
                </div>
                <div className="crypto-info-row">
                  <span>Balance disponible:</span>
                  <span className="crypto-balance">
                    {balance.disponible.toFixed(8)} {selectedCrypto.symbol}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="form-step">
            <div className="step-header">
              <span className="step-number">2</span>
              <h3>Retirar a</h3>
            </div>

            <div className="withdrawal-tabs">
              <button
                className={'tab ' + (withdrawalType === 'address' ? 'active' : '')}
                onClick={() => setWithdrawalType('address')}
              >
                Direccion
              </button>
              <button
                className={'tab ' + (withdrawalType === 'user' ? 'active' : '')}
                onClick={() => setWithdrawalType('user')}
                disabled
              >
                Usuario interno
              </button>
            </div>

            <div className="form-group">
              <label>Direccion de destino</label>
              <input
                type="text"
                className="form-input"
                placeholder="0x0000000000000000000000000000000000000000"
                value={destinationAddress}
                onChange={(e) => {
                  setDestinationAddress(e.target.value);
                  setAddressError('');
                  setError('');
                }}
                onBlur={() => validateAddress(destinationAddress)}
              />
              {addressError && (
                <span className="input-error">{addressError}</span>
              )}
            </div>

            {selectedCrypto && (
              <div className="form-group">
                <label>Red</label>
                <div className="network-display">
                  <span className="network-badge">{selectedCrypto.red}</span>
                  <span className="network-info">
                    Direccion del contrato terminada en .{selectedCrypto.red.toLowerCase()}
                  </span>
                </div>
              </div>
            )}

            <div className="warning-box">
              <p>
                <strong>PRECAUCION:</strong> Asegurate de que la direccion del destinatario 
                este activada y autorizada para recibir la direccion del contrato del token; 
                de lo contrario, tu retiro fallara.
              </p>
            </div>
          </div>

          <div className="form-step">
            <div className="step-header">
              <span className="step-number">3</span>
              <h3>Importe del retiro</h3>
            </div>

            <div className="form-group">
              <div className="amount-input-wrapper">
                <input
                  type="text"
                  className="form-input amount-input"
                  placeholder="0.00000000"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                />
                <div className="amount-suffix">
                  <span className="amount-crypto">{selectedCrypto ? selectedCrypto.symbol : 'USDT'}</span>
                  <button
                    className="btn-max"
                    onClick={setMaxAmount}
                    disabled={balance.disponible <= 0}
                  >
                    MAX.
                  </button>
                </div>
              </div>
              <span className="input-hint">como minimo: 0.00000001</span>
            </div>

            {destinationAddress && (
              <div className="info-box">
                <p>
                  Esta direccion no se ha utilizado recientemente. Para evitar errores, 
                  te recomendamos efectuar primero un <strong>retiro de prueba</strong> con el importe minimo.
                </p>
              </div>
            )}

            <div className="withdrawal-summary">
              <div className="summary-row">
                <span>Retiro disponible</span>
                <span className="summary-value">
                  {balance.disponible.toFixed(8)} {selectedCrypto ? selectedCrypto.symbol : 'USDT'}
                </span>
              </div>
              <div className="summary-row">
                <span>Limite restante a las 24 h</span>
                <span className="summary-value">
                  8 000 000,0 {selectedCrypto ? selectedCrypto.symbol : 'USDT'} / 8 000 000,0 {selectedCrypto ? selectedCrypto.symbol : 'USDT'}
                </span>
              </div>
              <div className="summary-row total">
                <span>Cantidad total</span>
                <span className="summary-total">
                  {amount || '0.00'} {selectedCrypto ? selectedCrypto.symbol : 'USDT'}
                </span>
              </div>
              <div className="summary-row">
                <span>Comision de la red</span>
                <span className="summary-value">
                  0.00 {selectedCrypto ? selectedCrypto.symbol : 'USDT'}
                </span>
              </div>
            </div>
          </div>

          <button
            className="btn-withdraw"
            onClick={handleWithdraw}
            disabled={loading || !selectedCrypto || !destinationAddress || !amount}
          >
            {loading ? 'Procesando...' : 'Retirar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Retiros;