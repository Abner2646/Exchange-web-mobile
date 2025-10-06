import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BuildingOfficeIcon, ShieldCheckIcon, LockClosedIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import '../styles/HomePage.css';

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  // Estados para usuario logueado
  const [balances, setBalances] = useState([]);
  const [criptomonedas, setCriptomonedas] = useState([]);
  const [prices, setPrices] = useState({});
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Estados para tabla de mercados
  const [marketData, setMarketData] = useState([]);
  const [loadingMarket, setLoadingMarket] = useState(true);

  // Fetch data para usuario logueado (SOLO UNA VEZ)
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchUserData();
    } else {
      setLoadingAuth(false);
    }
  }, [isAuthenticated, token]);

  // Actualizar SOLO precios cada 30 seg
  useEffect(() => {
    if (isAuthenticated && token && criptomonedas.length > 0) {
      const interval = setInterval(updatePricesOnly, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token, criptomonedas]);

  // Fetch data para tabla de mercados (CoinGecko)
  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000); // 30 seg
    return () => clearInterval(interval);
  }, []);

  const fetchUserData = async () => {
    try {
      setLoadingAuth(true);

      // 1. Balances
      const balancesRes = await fetch('http://localhost:3001/api/balances/my/balances', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const balancesData = await balancesRes.json();
      const validBalances = Array.isArray(balancesData) ? balancesData : [];
      setBalances(validBalances);

      // 2. Cryptos del usuario
      const cryptoIds = [...new Set(validBalances.map(b => b.criptomonedaId))];
      
      if (cryptoIds.length === 0) {
        setCriptomonedas([]);
        setPrices({});
        setLoadingAuth(false);
        return;
      }

      const cryptoPromises = cryptoIds.map(id =>
        fetch(`http://localhost:3001/api/criptomoneda/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.ok ? res.json() : null)
      );

      const cryptoResults = await Promise.all(cryptoPromises);
      const cryptoData = cryptoResults.filter(c => c !== null);
      setCriptomonedas(cryptoData);

      // 3. Precios
      const pricesMap = {};
      const cryptosToFetch = [...cryptoData];
      const hasBTC = cryptoData.some(c => c.symbol === 'BTC');

      if (!hasBTC) {
        const btcRes = await fetch('http://localhost:3001/api/criptomoneda/symbol/BTC', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (btcRes.ok) {
          cryptosToFetch.push(await btcRes.json());
        }
      }

      await Promise.all(
        cryptosToFetch.map(async (crypto) => {
          if (crypto.symbol === 'USDT') {
            pricesMap['USDT'] = 1;
            return;
          }

          try {
            const priceRes = await fetch(
              `http://localhost:3001/api/parExchange/price/${crypto.symbol}/USDT`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (priceRes.ok) {
              const priceData = await priceRes.json();
              pricesMap[crypto.symbol] = priceData.price;
            }
          } catch (err) {
            console.warn(`Error precio ${crypto.symbol}:`, err);
          }
        })
      );

      setPrices(pricesMap);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoadingAuth(false);
    }
  };

  const updatePricesOnly = async () => {
    try {
      const pricesMap = {};
      const cryptosToFetch = [...criptomonedas];
      const hasBTC = criptomonedas.some(c => c.symbol === 'BTC');

      if (!hasBTC) {
        const btcRes = await fetch('http://localhost:3001/api/criptomoneda/symbol/BTC', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (btcRes.ok) {
          cryptosToFetch.push(await btcRes.json());
        }
      }

      await Promise.all(
        cryptosToFetch.map(async (crypto) => {
          if (crypto.symbol === 'USDT') {
            pricesMap['USDT'] = 1;
            return;
          }

          try {
            const priceRes = await fetch(
              `http://localhost:3001/api/parExchange/price/${crypto.symbol}/USDT`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (priceRes.ok) {
              const priceData = await priceRes.json();
              pricesMap[crypto.symbol] = priceData.price;
            }
          } catch (err) {
            console.warn(`Error actualizando precio ${crypto.symbol}:`, err);
          }
        })
      );

      setPrices(pricesMap);
    } catch (error) {
      console.error('Error actualizando precios:', error);
    }
  };

  const fetchMarketData = async () => {
    try {
      setLoadingMarket(true);
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false'
      );
      const data = await response.json();
      setMarketData(data);
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setLoadingMarket(false);
    }
  };

  const calcularTotales = () => {
    if (balances.length === 0) return { totalUSDT: 0, totalBTC: 0 };

    const totalUSDT = balances.reduce((acc, balance) => {
      const crypto = criptomonedas.find(c => c.id === balance.criptomonedaId);
      const price = prices[crypto?.symbol] || 0;
      return acc + (parseFloat(balance.balanceDisponible) * price);
    }, 0);

    const btcPrice = prices['BTC'];
    const totalBTC = btcPrice && btcPrice > 0 ? totalUSDT / btcPrice : 0;

    return { totalUSDT, totalBTC };
  };

  const getPieChartData = () => {
    return balances
      .map(balance => {
        const crypto = criptomonedas.find(c => c.id === balance.criptomonedaId);
        if (!crypto) return null;

        const price = prices[crypto.symbol] || 0;
        const value = parseFloat(balance.balanceDisponible) * price;

        return {
          symbol: crypto.symbol,
          value: value,
          percentage: 0
        };
      })
      .filter(item => item !== null && item.value > 0)
      .sort((a, b) => b.value - a.value);
  };

  const getTopAssets = () => {
    const data = getPieChartData();
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    return data.slice(0, 5).map(item => ({
      ...item,
      percentage: ((item.value / total) * 100).toFixed(1)
    }));
  };

  const { totalUSDT, totalBTC } = calcularTotales();
  const topAssets = getTopAssets();

  const handleCryptoClick = (symbol) => {
    navigate(`/swap?from=${symbol}&to=USDT`);
  };

  const scrollToMarkets = () => {
    document.getElementById('markets-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isAuthenticated && loadingAuth) {
    return (
      <div className="home-loading">
        <p>Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="home-page">
      {!isAuthenticated ? (
        // VISTA NO LOGUEADO
        <>
          <section className="hero-section">
            <div className="hero-content">
              <h1 className="hero-title">
                Tu Gateway al Futuro de las Criptomonedas
              </h1>
              <p className="hero-subtitle">
                Opera con confianza en el exchange más seguro y avanzado de Latinoamérica. 
                Accede a las mejores criptomonedas con spreads competitivos y tecnología de vanguardia.
              </p>
              <div className="hero-actions">
                <button className="btn-primary" onClick={() => navigate('/register')}>
                  Comenzar a Operar
                </button>
                <button className="home-btn-secondary" onClick={scrollToMarkets}>
                  Ver Mercados
                </button>
              </div>
            </div>
          </section>
        </>
      ) : (
        // VISTA LOGUEADO
        <section className="dashboard-section">
          <div className="dashboard-grid">
            <div className="balance-card card">
              <div className="balance-header">
                <div>
                  <h3 className="balance-label">Portfolio</h3>
                  <h1 className="balance-amount">${totalUSDT.toFixed(2)}</h1>
                  <p className="balance-btc">≈ {totalBTC.toFixed(8)} BTC</p>
                </div>
              </div>
              <div className="balance-actions">
                <button className="home-action-btn" onClick={() => navigate('/depositos')}>
                  Depositar
                </button>
                <button className="home-action-btn" onClick={() => navigate('/retiros')}>
                  Retirar
                </button>
                <button className="home-action-btn" onClick={() => navigate('/transferir')}>
                  Transferir
                </button>
                <button className="home-action-btn primary" onClick={() => navigate('/swap')}>
                  Swap
                </button>
                <button className="home-action-btn primary" onClick={() => navigate('/p2p')}>
                  P2P
                </button>
              </div>
            </div>

            {topAssets.length > 0 && (
              <div className="assets-card card">
                <h3>Top Activos</h3>
                <div className="assets-list">
                  {topAssets.map((asset, index) => (
                    <div key={index} className="asset-item">
                      <div className="asset-info">
                        <span className="asset-symbol">{asset.symbol}</span>
                        <span className="asset-percentage">{asset.percentage}%</span>
                      </div>
                      <div className="asset-bar">
                        <div 
                          className="asset-bar-fill" 
                          style={{ width: `${asset.percentage}%` }}
                        />
                      </div>
                      <span className="asset-value">${asset.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <section className="markets-section" id="markets-section">
        <h2 className="section-title">Mercados Populares</h2>
        <div className="markets-table-container">
          {loadingMarket ? (
            <p className="loading-text">Cargando mercados...</p>
          ) : (
            <table className="markets-table">
              <thead>
                <tr>
                  <th>Moneda</th>
                  <th>Precio</th>
                  <th>Cambio 24h</th>
                  <th>Volumen 24h</th>
                  <th>Cap. Mercado</th>
                </tr>
              </thead>
              <tbody>
                {marketData.map((coin) => (
                  <tr 
                    key={coin.id} 
                    className="market-row"
                    onClick={() => handleCryptoClick(coin.symbol.toUpperCase())}
                  >
                    <td className="coin-cell">
                      <div className="coin-info">
                        <img src={coin.image} alt={coin.name} className="home-crypto-icon" />
                        <div>
                          <div className="coin-symbol">{coin.symbol.toUpperCase()}</div>
                          <div className="coin-name">{coin.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="price-cell">
                      ${coin.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`change-cell ${coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}`}>
                      {coin.price_change_percentage_24h >= 0 ? '+' : ''}
                      {coin.price_change_percentage_24h.toFixed(2)}%
                    </td>
                    <td className="volume-cell">
                      ${(coin.total_volume / 1000000).toFixed(2)}M
                    </td>
                    <td className="marketcap-cell">
                      ${(coin.market_cap / 1000000000).toFixed(2)}B
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {!isAuthenticated && (
        <section className="features-section">
          <h2 className="section-title">¿Por qué somos la compañía más confiable?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <BuildingOfficeIcon className="icon-size" />
              </div>
              <h3>La empresa crypto pública más grande del mundo</h3>
              <p>Operamos con transparencia financiera.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <ShieldCheckIcon className="icon-size" />
              </div>
              <h3>Tus activos están protegidos</h3>
              <p>Nuestras medidas de gestión de riesgos están diseñadas para proteger tus activos.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <LockClosedIcon className="icon-size" />
              </div>
              <h3>Funcionalidades de seguridad avanzadas</h3>
              <p>Utilizamos las mejores prácticas de la industria para aumentar la seguridad de nuestra plataforma.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <UserCircleIcon className="icon-size" />
              </div>
              <h3>Respetamos tu privacidad</h3>
              <p>Solo recopilamos los datos personales para brindarte la mejor protección y los mejores servicios posibles.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default HomePage;