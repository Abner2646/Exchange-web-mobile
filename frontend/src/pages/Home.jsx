import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BuildingOfficeIcon, ShieldCheckIcon, LockClosedIcon, UserCircleIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages] = useState(3);
  const cryptosPerPage = 10;
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [cachedData, setCachedData] = useState([]);

  // Estado para FAQ
  const [openFaqIndex, setOpenFaqIndex] = useState(null);

  // Ref para CountUp
  const portfolioRef = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);

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

  // Fetch data para tabla de mercados (CoinGecko) - CARGA INICIAL
  useEffect(() => {
    fetchMarketData();
  }, []);

  // Actualizar tabla cuando cambia la página
  useEffect(() => {
    const isInitialLoad = currentPage === 1 && marketData.length === 0;
    if (!isInitialLoad && currentPage >= 1) {
      fetchMarketData(true);
      scrollToMarketsTable();
    }
  }, [currentPage]);

  // Auto-refresh cada 30 segundos (solo si no está cambiando de página)
  useEffect(() => {
    if (!isTransitioning) {
      const interval = setInterval(() => fetchMarketData(false), 30000);
      return () => clearInterval(interval);
    }
  }, [currentPage, isTransitioning]);

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

  const fetchMarketData = async (isPageChange = false) => {
    try {
      if (isPageChange) {
        setIsTransitioning(true);
        setCachedData(marketData);
      } else {
        setLoadingMarket(true);
      }

      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${cryptosPerPage}&page=${currentPage}&sparkline=false`
      );
      const data = await response.json();
      
      if (isPageChange) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      setMarketData(data);
      setCachedData([]);
    } catch (error) {
      console.error('Error fetching market data:', error);
      setMarketData(cachedData.length > 0 ? cachedData : marketData);
    } finally {
      setLoadingMarket(false);
      setIsTransitioning(false);
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

  useEffect(() => {
    if (isAuthenticated && !hasAnimated && totalUSDT > 0) {
      animateValue(0, totalUSDT, 1500);
      setHasAnimated(true);
    }
  }, [totalUSDT, isAuthenticated, hasAnimated]);

  const animateValue = (start, end, duration) => {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        current = end;
        clearInterval(timer);
      }
      if (portfolioRef.current) {
        portfolioRef.current.textContent = current.toFixed(2);
      }
    }, 16);
  };

  const scrollToMarketsTable = () => {
    const marketsSection = document.getElementById('markets-section');
    if (marketsSection) {
      const offset = 80;
      const elementPosition = marketsSection.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage !== currentPage && newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const toggleFaq = (index) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const faqData = [
    {
      question: "¿Qué es un exchange de criptomonedas?",
      answer: "Un exchange de criptomonedas es una plataforma digital que permite comprar, vender e intercambiar criptomonedas. Funciona como intermediario entre compradores y vendedores, ofreciendo un entorno seguro para realizar transacciones con activos digitales como Bitcoin, Ethereum y otras criptomonedas."
    },
    {
      question: "¿Cómo comprar Bitcoin en nuestro exchange?",
      answer: "Para comprar Bitcoin, primero debes crear una cuenta y verificar tu identidad. Luego, deposita fondos mediante transferencia bancaria o tarjeta. Una vez que tengas saldo disponible, dirígete a la sección de Mercados o Swap, selecciona Bitcoin (BTC), ingresa la cantidad que deseas comprar y confirma la transacción."
    },
    {
      question: "¿Es seguro operar en este exchange?",
      answer: "Sí, implementamos múltiples capas de seguridad: autenticación de dos factores (2FA), encriptación de datos, almacenamiento en frío para la mayoría de fondos, y auditorías de seguridad regulares. Además, cumplimos con regulaciones financieras internacionales para proteger tus activos."
    },
    {
      question: "¿Qué comisiones cobra el exchange?",
      answer: "Nuestras comisiones son competitivas y transparentes. Cobramos una comisión por transacción que varía entre 0.1% y 0.5% dependiendo del volumen de trading mensual. Los depósitos suelen ser gratuitos, mientras que los retiros tienen una tarifa mínima de red. Consulta nuestra página de tarifas para más detalles."
    },
    {
      question: "¿Cómo verifico mi cuenta?",
      answer: "La verificación de cuenta es un proceso simple: 1) Proporciona tu información personal básica, 2) Sube una foto de tu documento de identidad vigente, 3) Realiza una selfie para verificación facial. El proceso usualmente toma entre 24-48 horas hábiles."
    },
    {
      question: "¿Cuánto tiempo tarda un retiro?",
      answer: "Los retiros de criptomonedas generalmente se procesan en 15-30 minutos después de la confirmación. Los retiros en moneda fiat (dinero tradicional) pueden tardar de 1 a 5 días hábiles dependiendo del método bancario. Todos los retiros pasan por verificaciones de seguridad para proteger tus fondos."
    },
    {
      question: "¿Qué métodos de pago aceptan?",
      answer: "Aceptamos múltiples métodos de pago: transferencias bancarias, tarjetas de crédito/débito, y depósitos en criptomonedas desde otras wallets. También ofrecemos opciones de pago locales en diferentes países para facilitar el acceso a nuestros servicios."
    },
    {
      question: "¿Puedo operar desde mi país?",
      answer: "Operamos en la mayoría de países de Latinoamérica y el mundo. Sin embargo, por regulaciones locales, algunos países pueden tener restricciones. Puedes verificar si tu país está disponible durante el proceso de registro o contactando a nuestro equipo de soporte."
    }
  ];

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
        <section className="dashboard-section">
          <div className="dashboard-grid">
            <div className="balance-card card">
              <div className="balance-header">
                <div>
                  <h3 className="balance-label">Portfolio</h3>
                  <div className="balance-amount-container">
                    <span className="balance-currency">$</span>
                    <h1 className="balance-amount" ref={portfolioRef}>{totalUSDT.toFixed(2)}</h1>
                    <span className="balance-currency">USD</span>
                  </div>
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
        <div className={`markets-table-container ${isTransitioning ? 'transitioning' : ''}`}>
          {loadingMarket && cachedData.length === 0 ? (
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
                {[...Array(10)].map((_, i) => (
                  <tr key={i} className="skeleton-row">
                    <td className="coin-cell">
                      <div className="coin-info">
                        <div className="skeleton skeleton-icon"></div>
                        <div>
                          <div className="skeleton skeleton-text skeleton-text-short"></div>
                          <div className="skeleton skeleton-text skeleton-text-long"></div>
                        </div>
                      </div>
                    </td>
                    <td><div className="skeleton skeleton-text skeleton-text-medium"></div></td>
                    <td><div className="skeleton skeleton-text skeleton-text-short"></div></td>
                    <td><div className="skeleton skeleton-text skeleton-text-medium"></div></td>
                    <td><div className="skeleton skeleton-text skeleton-text-medium"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <>
              {isTransitioning && <div className="table-overlay" />}
              <div className={`table-content ${isTransitioning ? 'fading' : ''}`}>
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
                    {(cachedData.length > 0 && isTransitioning ? cachedData : marketData).map((coin) => (
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
              </div>
              
              <div className="pagination">
                <button 
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isTransitioning}
                >
                  <ChevronLeftIcon className="pagination-icon" />
                  Anterior
                </button>
                
                <div className="pagination-pages">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i + 1}
                      className={`pagination-page ${currentPage === i + 1 ? 'active' : ''}`}
                      onClick={() => handlePageChange(i + 1)}
                      disabled={isTransitioning}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                
                <button 
                  className="pagination-btn"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || isTransitioning}
                >
                  Siguiente
                  <ChevronRightIcon className="pagination-icon" />
                </button>
              </div>
            </>
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

      <section className="faq-section">
        <h2 className="section-title">Preguntas Frecuentes</h2>
        <div className="faq-container">
          {faqData.map((faq, index) => (
            <div key={index} className="faq-item">
              <button 
                className={`faq-question ${openFaqIndex === index ? 'active' : ''}`}
                onClick={() => toggleFaq(index)}
              >
                <span>{faq.question}</span>
                <ChevronDownIcon className={`faq-icon ${openFaqIndex === index ? 'rotated' : ''}`} />
              </button>
              <div className={`faq-answer ${openFaqIndex === index ? 'open' : ''}`}>
                <p>{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;