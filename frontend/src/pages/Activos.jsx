import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/BalancePage.css';

const BalancePage = () => {
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const [balances, setBalances] = useState([]);
  const [criptomonedas, setCriptomonedas] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('moneda');
  const [hideSmallBalances, setHideSmallBalances] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setError('No hay token de autenticación');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // 1. Obtener balances del usuario
        const balancesResponse = await fetch('http://localhost:3001/api/balances/my/balances', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!balancesResponse.ok) {
          throw new Error(`Error ${balancesResponse.status}: ${await balancesResponse.text()}`);
        }
        
        const balancesData = await balancesResponse.json();
        console.log('Balances recibidos:', balancesData);
        const validBalances = Array.isArray(balancesData) ? balancesData : [];
        setBalances(validBalances);

        // 2. Extraer IDs únicos de criptomonedas que el usuario TIENE
        const cryptoIds = [...new Set(validBalances.map(b => b.criptomonedaId))];
        console.log('IDs de criptos con balance:', cryptoIds);

        if (cryptoIds.length === 0) {
          setCriptomonedas([]);
          setPrices({});
          setLoading(false);
          return;
        }

        // 3. Obtener SOLO las criptomonedas que tiene el usuario (en paralelo)
        const cryptoPromises = cryptoIds.map(id =>
          fetch(`http://localhost:3001/api/criptomoneda/${id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }).then(res => res.ok ? res.json() : null)
        );

        const cryptoResults = await Promise.all(cryptoPromises);
        const cryptoData = cryptoResults.filter(c => c !== null);
        console.log('Criptomonedas obtenidas:', cryptoData);
        setCriptomonedas(cryptoData);

        // 4. Obtener precios de las criptos que tiene + BTC (para conversión)
        const pricesMap = {};
        
        // SIEMPRE obtener precio de BTC para el cálculo del balance total
        const cryptosToFetch = [...cryptoData];
        const hasBTC = cryptoData.some(c => c.symbol === 'BTC');
        
        // Si no tiene BTC, agregarlo para obtener su precio
        if (!hasBTC) {
          try {
            const btcResponse = await fetch('http://localhost:3001/api/criptomoneda/symbol/BTC', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            if (btcResponse.ok) {
              const btcData = await btcResponse.json();
              cryptosToFetch.push(btcData);
            }
          } catch (error) {
            console.warn('No se pudo obtener info de BTC');
          }
        }

        const pricePromises = cryptosToFetch.map(async (crypto) => {
          if (crypto.symbol === 'USDT') {
            pricesMap['USDT'] = 1;
            return;
          }

          try {
            const priceResponse = await fetch(
              `http://localhost:3001/api/parExchange/price/${crypto.symbol}/USDT`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            
            if (priceResponse.ok) {
              const priceData = await priceResponse.json();
              pricesMap[crypto.symbol] = priceData.price;
              console.log(`Precio ${crypto.symbol}/USDT:`, priceData.price);
            }
          } catch (error) {
            console.warn(`No se pudo obtener precio para ${crypto.symbol}/USDT`);
          }
        });

        await Promise.all(pricePromises);
        setPrices(pricesMap);
        
      } catch (error) {
        console.error('Error al cargar datos:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const calcularTotales = () => {
    if (balances.length === 0) return { totalUSDT: 0, totalBTC: 0 };

    const totalUSDT = balances.reduce((acc, balance) => {
      const crypto = criptomonedas.find(c => c.id === balance.criptomonedaId);
      const price = prices[crypto?.symbol] || 0;
      return acc + (parseFloat(balance.balanceDisponible) * price);
    }, 0);

    const btcPrice = prices['BTC'];
    
    // Si no hay precio de BTC, no podemos calcular
    if (!btcPrice || btcPrice === 0) {
      return { totalUSDT, totalBTC: 0, btcPriceError: true };
    }
    
    const totalBTC = totalUSDT / btcPrice;

    return { totalUSDT, totalBTC, btcPriceError: false };
  };

  const { totalUSDT, totalBTC, btcPriceError } = calcularTotales();

  const handleNavigation = (path) => {
    if (token) {
      navigate(path);
    } else {
      navigate('/login');
    }
  };

  const enrichedBalances = balances
    .map(balance => {
      const crypto = criptomonedas.find(c => c.id === balance.criptomonedaId);
      if (!crypto) return null;

      const price = prices[crypto.symbol] || 0;
      const balanceAmount = parseFloat(balance.balanceDisponible);
      const valueInUSDT = balanceAmount * price;

      return {
        ...balance,
        crypto,
        price,
        valueInUSDT,
        balanceAmount
      };
    })
    .filter(b => b !== null)
    .filter(b => {
      if (hideSmallBalances) {
        return b.valueInUSDT >= 1;
      }
      return true;
    });

  if (loading) {
    return (
      <div className="bp-page">
        <div className="bp-loading-state">
          <p>Cargando balances...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bp-page">
        <div className="bp-error-state">
          <h3>Error al cargar datos</h3>
          <p>{error}</p>
          <button className="bp-btn-primary" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bp-page">
      <div className="bp-header bp-card">
        <div className="bp-header-grid">
          <div className="bp-info">
            <div className="bp-label">
              <h2>Balance estimado</h2>
              <span className="bp-icon-eye">👁</span>
            </div>

            <div className="bp-amount">
              <h1>{btcPriceError ? '---' : totalBTC.toFixed(8)}</h1>
              <span className="bp-currency">BTC ▼</span>
            </div>

            <p className="bp-fiat">
              ≈ {totalUSDT.toFixed(2)} USDT
              {btcPriceError && <span className="bp-warning-text">(Sin precio BTC)</span>}
            </p>
          </div>

          <div className="bp-actions">
            <button className="bp-action-btn" onClick={() => handleNavigation('/depositos')}>
              Depositar
            </button>
            <button className="bp-action-btn" onClick={() => handleNavigation('/retiros')}>
              Retirar
            </button>
            <button className="bp-action-btn" onClick={() => handleNavigation('/transferir')}>
              Transferir*
            </button>
            <button className="bp-action-btn" onClick={() => handleNavigation('/historial')}>
              Historial*
            </button>
          </div>
        </div>
      </div>

      <div className="bp-assets-section bp-card">
        <header className="bp-assets-header">
          <h2>Mis activos</h2>

          <div className="bp-assets-controls">
            <div className="bp-assets-tabs">
              <button
                className={`bp-tab ${activeTab === 'moneda' ? 'bp-active' : ''}`}
                onClick={() => setActiveTab('moneda')}
              >
                Vista por moneda
              </button>
            </div>

            <div className="bp-assets-filters">
              <label className="bp-hide-small-checkbox">
                <input
                  type="checkbox"
                  checked={hideSmallBalances}
                  onChange={(e) => setHideSmallBalances(e.target.checked)}
                />
                Ocultar activos inferiores a 1 USD
              </label>
            </div>
          </div>
        </header>

        <table className="bp-assets-table">
          <thead>
            <tr>
              <th className="bp-th-coin">Moneda</th>
              <th className="bp-th-amount">Importe</th>
              <th className="bp-th-value">Valor</th>
              <th className="bp-th-actions"></th>
            </tr>
          </thead>
          <tbody>
            {enrichedBalances.length === 0 ? (
              <tr>
                <td colSpan="4" className="bp-empty-state">
                  No tienes activos disponibles
                </td>
              </tr>
            ) : (
              enrichedBalances.map((balance) => (
                <tr key={balance.id} className="bp-asset-row">
                  <td className="bp-coin-cell">
                    <div className="bp-coin-info">
                      <div className="bp-coin-avatar">
                        {balance.crypto.iconUrl ? (
                          <img 
                            src={balance.crypto.iconUrl} 
                            alt={balance.crypto.symbol}
                            className="bp-coin-icon"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <span className="bp-coin-fallback">
                          {balance.crypto.symbol.charAt(0)}
                        </span>
                      </div>
                      <div className="bp-coin-details">
                        <div className="bp-coin-symbol">{balance.crypto.symbol}</div>
                        <div className="bp-coin-name">{balance.crypto.nombre}</div>
                      </div>
                    </div>
                  </td>
                  <td className="bp-amount-cell">
                    <div className="bp-amount-crypto">{balance.balanceAmount.toFixed(8)}</div>
                  </td>
                  <td className="bp-value-cell">
                    <div className="bp-value-amount">{balance.valueInUSDT.toFixed(2)} USDT</div>
                    <div className="bp-value-price">{balance.price.toFixed(2)} USDT</div>
                  </td>
                  <td className="bp-actions-cell">
                    <button className="bp-expand-btn">⋯</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BalancePage;