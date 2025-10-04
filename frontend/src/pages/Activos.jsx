import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/BalancePage.css';

const BalancePage = () => {
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const [balances, setBalances] = useState([]);
  const [criptomonedas, setCriptomonedas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('moneda');
  const [hideSmallBalances, setHideSmallBalances] = useState(false);

  const mockPrices = {
    'BTC': 100000,
    'ETH': 3000,
    'USDT': 0.85,
    'SOL': 193.36,
    'USDC': 0.85
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setError('No hay token de autenticación');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
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
        setBalances(Array.isArray(balancesData) ? balancesData : []);

        const cryptoResponse = await fetch('http://localhost:3001/api/criptomoneda/', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!cryptoResponse.ok) {
          throw new Error(`Error ${cryptoResponse.status}: ${await cryptoResponse.text()}`);
        }
        
        const cryptoData = await cryptoResponse.json();
        console.log('Criptomonedas recibidas:', cryptoData);
        setCriptomonedas(Array.isArray(cryptoData) ? cryptoData : []);
        
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
    if (balances.length === 0) return { total: 0, pnl: 0 };

    const total = balances.reduce((acc, balance) => {
      const crypto = criptomonedas.find(c => c.id === balance.criptomonedaId);
      const price = mockPrices[crypto?.symbol] || 0;
      return acc + (parseFloat(balance.balanceDisponible) * price);
    }, 0);

    const pnl = total * -0.0082;

    return { total, pnl };
  };

  const { total: balanceTotal, pnl: pnlToday } = calcularTotales();

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

      const price = mockPrices[crypto.symbol] || 0;
      const balanceAmount = parseFloat(balance.balanceDisponible);
      const valueInEur = balanceAmount * price;
      const pnlToday = valueInEur * (Math.random() * 0.1 - 0.05);

      return {
        ...balance,
        crypto,
        price,
        valueInEur,
        pnlToday,
        balanceAmount
      };
    })
    .filter(b => b !== null)
    .filter(b => {
      if (hideSmallBalances) {
        return b.valueInEur >= 1;
      }
      return true;
    });

  if (loading) {
    return (
      <div className="balance-page">
        <div className="loading-state">
          <p>Cargando balances...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="balance-page">
        <div className="error-state">
          <h3>Error al cargar datos</h3>
          <p>{error}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="balance-page">
      <div className="balance-header card">
        <div className="balance-header-grid">
          <div className="balance-info">
            <div className="balance-label">
              <h2>Balance estimado</h2>
              <span className="icon-eye">👁</span>
            </div>

            <div className="balance-amount">
              <h1>{(balanceTotal / mockPrices.BTC).toFixed(8)}</h1>
              <span className="balance-currency">BTC ▼</span>
            </div>

            <p className="balance-fiat">≈ {balanceTotal.toFixed(2)} €</p>

            <div className="balance-pnl">
              <span className="pnl-label">PnL de hoy</span>
              <span className="icon-info">ℹ</span>
              <span className={`pnl-value ${pnlToday < 0 ? 'negative' : 'positive'}`}>
                {pnlToday.toFixed(2)} € ({((pnlToday / balanceTotal) * 100).toFixed(2)}%)
              </span>
            </div>
          </div>

          <div className="balance-actions">
            <button className="action-btn" onClick={() => handleNavigation('/depositos')}>
              Depositar
            </button>
            <button className="action-btn" onClick={() => handleNavigation('/retiros')}>
              Retirar
            </button>
            <button className="action-btn" onClick={() => handleNavigation('/transferir')}>
              Transferir
            </button>
            <button className="action-btn" onClick={() => handleNavigation('/historial')}>
              Historial
            </button>
          </div>
        </div>
      </div>

      <div className="assets-section card">
        <header className="assets-header">
          <h2>Mis activos</h2>

          <div className="assets-controls">
            <div className="assets-tabs">
              <button
                className={`tab ${activeTab === 'moneda' ? 'active' : ''}`}
                onClick={() => setActiveTab('moneda')}
              >
                Vista por moneda
              </button>
              <button
                className={`tab ${activeTab === 'cuenta' ? 'active' : ''}`}
                onClick={() => setActiveTab('cuenta')}
              >
                Vista de cuenta
              </button>
            </div>

            <div className="assets-filters">
              <button className="search-btn">🔍</button>
              <label className="hide-small-checkbox">
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

        <table className="assets-table">
          <thead>
            <tr>
              <th className="th-coin">Moneda</th>
              <th className="th-amount">Importe</th>
              <th className="th-price">
                Precio de la moneda / Precio de coste
                <span className="icon-info">ℹ</span>
              </th>
              <th className="th-pnl">PnL de hoy</th>
              <th className="th-actions"></th>
            </tr>
          </thead>
          <tbody>
            {enrichedBalances.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-state">
                  No tienes activos disponibles
                </td>
              </tr>
            ) : (
              enrichedBalances.map((balance) => (
                <tr key={balance.id} className="asset-row">
                  <td className="coin-cell">
                    <div className="coin-info">
                      <div className="coin-avatar">
                        {balance.crypto.symbol.charAt(0)}
                      </div>
                      <div className="coin-details">
                        <div className="coin-symbol">{balance.crypto.symbol}</div>
                        <div className="coin-name">{balance.crypto.nombre}</div>
                      </div>
                    </div>
                  </td>
                  <td className="amount-cell">
                    <div className="amount-crypto">{balance.balanceAmount.toFixed(8)}</div>
                    <div className="amount-fiat">{balance.valueInEur.toFixed(2)} €</div>
                  </td>
                  <td className="price-cell">
                    <div className="price-current">{balance.price.toFixed(2)} €</div>
                    <div className="price-cost">--</div>
                  </td>
                  <td className="pnl-cell">
                    <div className={`pnl-amount ${balance.pnlToday >= 0 ? 'positive' : 'negative'}`}>
                      {balance.pnlToday >= 0 ? '+' : ''}{balance.pnlToday.toFixed(2)} €
                    </div>
                  </td>
                  <td className="actions-cell">
                    <button className="expand-btn">▼</button>
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