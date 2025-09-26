import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/Home.css';

const Home = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [cryptoData, setCryptoData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTimeframe, setSelectedTimeframe] = useState('24h');

    // Mock data - aquí conectarías tu API real de precios
    useEffect(() => {
        const fetchCryptoData = async () => {
            // Simular llamada a API
            setTimeout(() => {
                setCryptoData([
                    { symbol: 'BTC/USDT', price: '45,678.90', change: '+5.32', changePercent: '+5.32%', volume: '1.2B', isPositive: true },
                    { symbol: 'ETH/USDT', price: '2,345.67', change: '-2.15', changePercent: '-2.15%', volume: '845M', isPositive: false },
                    { symbol: 'BNB/USDT', price: '312.45', change: '+1.87', changePercent: '+1.87%', volume: '234M', isPositive: true },
                    { symbol: 'XRP/USDT', price: '0.6234', change: '+3.45', changePercent: '+3.45%', volume: '156M', isPositive: true },
                    { symbol: 'ADA/USDT', price: '0.4567', change: '-1.23', changePercent: '-1.23%', volume: '89M', isPositive: false },
                    { symbol: 'SOL/USDT', price: '98.76', change: '+7.89', changePercent: '+7.89%', volume: '445M', isPositive: true },
                ]);
                setLoading(false);
            }, 1000);
        };

        fetchCryptoData();
    }, []);

    const handleTradeClick = (symbol) => {
        if (!isAuthenticated) {
            navigate('/login');
        } else {
            navigate(`/trade/${symbol.replace('/', '-')}`);
        }
    };

    return (
        <div className="home-container">
            {/* Hero Section */}
            <section className="home-hero">
                <div className="home-hero-content">
                    <div className="home-hero-text">
                        <h1 className="home-hero-title">
                            Tu Gateway al Futuro de las Criptomonedas
                        </h1>
                        <p className="home-hero-description">
                            Opera con confianza en el exchange más seguro y avanzado de Latinoamérica. 
                            Accede a las mejores criptomonedas con spreads competitivos y tecnología de vanguardia.
                        </p>
                        <div className="home-hero-buttons">
                            <button 
                                className="btn-primary home-hero-cta"
                                onClick={() => isAuthenticated ? navigate('/trade') : navigate('/register')}
                            >
                                {isAuthenticated ? 'Comenzar a Operar' : 'Crear Cuenta Gratis'}
                            </button>
                            <button className="home-hero-secondary">
                                Ver Mercados
                            </button>
                        </div>
                    </div>
                    <div className="home-hero-visual">
                        <div className="home-hero-card">
                            <div className="home-hero-card-header">
                                <h3>Portfolio</h3>
                                <span className="home-hero-card-balance">$12,345.67</span>
                            </div>
                            <div className="home-hero-card-change">
                                <span className="text-success">+$1,234.56 (+11.23%)</span>
                                <span className="home-hero-timeframe">24h</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Market Overview */}
            <section className="home-market">
                <div className="home-section-header">
                    <h2 className="home-section-title">Mercados en Tiempo Real</h2>
                    <div className="home-timeframe-selector">
                        {['24h', '7d', '30d'].map((timeframe) => (
                            <button 
                                key={timeframe}
                                className={`home-timeframe-btn ${selectedTimeframe === timeframe ? 'active' : ''}`}
                                onClick={() => setSelectedTimeframe(timeframe)}
                            >
                                {timeframe}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="home-market-table">
                    <div className="home-market-header">
                        <div className="home-market-col">Par</div>
                        <div className="home-market-col">Precio</div>
                        <div className="home-market-col">Cambio 24h</div>
                        <div className="home-market-col">Volumen</div>
                        <div className="home-market-col">Acción</div>
                    </div>
                    
                    {loading ? (
                        <div className="home-market-loading">
                            <div className="home-loading-spinner"></div>
                            <span>Cargando precios en tiempo real...</span>
                        </div>
                    ) : (
                        cryptoData.map((crypto, index) => (
                            <div key={index} className="home-market-row">
                                <div className="home-market-col">
                                    <div className="home-crypto-info">
                                        <div className="home-crypto-icon">
                                            {crypto.symbol.split('/')[0].slice(0, 2)}
                                        </div>
                                        <div>
                                            <div className="home-crypto-name">{crypto.symbol}</div>
                                            <div className="home-crypto-full">{crypto.symbol.split('/')[0]}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="home-market-col">
                                    <span className="home-crypto-price">${crypto.price}</span>
                                </div>
                                <div className="home-market-col">
                                    <span className={`home-crypto-change ${crypto.isPositive ? 'text-success' : 'text-error'}`}>
                                        {crypto.changePercent}
                                    </span>
                                </div>
                                <div className="home-market-col">
                                    <span className="home-crypto-volume">${crypto.volume}</span>
                                </div>
                                <div className="home-market-col">
                                    <button 
                                        className="btn-buy"
                                        onClick={() => handleTradeClick(crypto.symbol)}
                                    >
                                        Operar
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

            {/* Stats Section */}
            <section className="home-stats">
                <div className="home-stats-grid">
                    <div className="home-stat-card">
                        <div className="home-stat-icon">📊</div>
                        <div className="home-stat-content">
                            <h3 className="home-stat-number">$2.4B+</h3>
                            <p className="home-stat-label">Volumen 24h</p>
                        </div>
                    </div>
                    <div className="home-stat-card">
                        <div className="home-stat-icon">👥</div>
                        <div className="home-stat-content">
                            <h3 className="home-stat-number">150K+</h3>
                            <p className="home-stat-label">Usuarios Activos</p>
                        </div>
                    </div>
                    <div className="home-stat-card">
                        <div className="home-stat-icon">🔒</div>
                        <div className="home-stat-content">
                            <h3 className="home-stat-number">100%</h3>
                            <p className="home-stat-label">Fondos Seguros</p>
                        </div>
                    </div>
                    <div className="home-stat-card">
                        <div className="home-stat-icon">⚡</div>
                        <div className="home-stat-content">
                            <h3 className="home-stat-number">&lt; 10ms</h3>
                            <p className="home-stat-label">Latencia</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="home-features">
                <h2 className="home-section-title">¿Por qué elegir nuestro Exchange?</h2>
                <div className="home-features-grid">
                    <div className="home-feature-card">
                        <div className="home-feature-icon">🛡️</div>
                        <h3 className="home-feature-title">Máxima Seguridad</h3>
                        <p className="home-feature-description">
                            Protección multicapa con autenticación 2FA, almacenamiento en frío y seguros para todos los fondos.
                        </p>
                    </div>
                    <div className="home-feature-card">
                        <div className="home-feature-icon">📈</div>
                        <h3 className="home-feature-title">Trading Avanzado</h3>
                        <p className="home-feature-description">
                            Herramientas profesionales, gráficos en tiempo real y órdenes avanzadas para maximizar tus ganancias.
                        </p>
                    </div>
                    <div className="home-feature-card">
                        <div className="home-feature-icon">💎</div>
                        <h3 className="home-feature-title">Mejores Precios</h3>
                        <p className="home-feature-description">
                            Spreads competitivos y alta liquidez para que siempre obtengas los mejores precios del mercado.
                        </p>
                    </div>
                    <div className="home-feature-card">
                        <div className="home-feature-icon">🎯</div>
                        <h3 className="home-feature-title">Soporte 24/7</h3>
                        <p className="home-feature-description">
                            Atención al cliente en español las 24 horas, con expertos listos para ayudarte en todo momento.
                        </p>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="home-cta">
                <div className="home-cta-content">
                    <h2 className="home-cta-title">Comienza tu Aventura Crypto Hoy</h2>
                    <p className="home-cta-description">
                        Únete a miles de traders que confían en nuestra plataforma para hacer crecer su patrimonio
                    </p>
                    <button 
                        className="btn-primary home-cta-button"
                        onClick={() => isAuthenticated ? navigate('/trade') : navigate('/register')}
                    >
                        {isAuthenticated ? 'Ir al Trading' : 'Registrarse Gratis'}
                    </button>
                </div>
            </section>
        </div>
    );
};

export default Home;