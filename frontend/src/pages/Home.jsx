// src/pages/Home.jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBalances } from '../hooks/useBalances';
import { useMarket } from '../hooks/useMarket';
import HeroSection from '../components/features/HeroSection';
import BalanceCard from '../components/features/BalanceCard';
import TopAssets from '../components/features/TopAssets';
import MarketTable from '../components/features/MarketTable';
import FeaturesSection from '../components/features/FeaturesSection';
import FAQSection from '../components/features/FAQSection';
import '../styles/HomePage.css';

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Hook de balances con toda la lógica
  const {
    portfolio,
    topAssets,
    isLoading: loadingBalances,
  } = useBalances();

  // Hook de mercado con toda la lógica
  const {
    marketData,
    isLoading: loadingMarket,
    currentPage,
    totalPages,
    goToPage,
    isTransitioning,
  } = useMarket();

  // Mostrar loading solo para usuarios autenticados
  if (isAuthenticated && loadingBalances) {
    return (
      <div className="home-loading">
        <p>Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="home-page">
      {!isAuthenticated ? (
        <HeroSection onNavigate={navigate} />
      ) : (
        <section className="dashboard-section">
          <div className="dashboard-grid">
            <BalanceCard
              totalUSDT={portfolio.totalUSDT}
              totalBTC={portfolio.totalBTC}
              btcPriceError={portfolio.btcPriceError}
              onNavigate={navigate}
            />
            <TopAssets 
              assets={topAssets} 
              onNavigate={navigate} 
            />
          </div>
        </section>
      )}

      <MarketTable
        data={marketData}
        loading={loadingMarket}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={goToPage}
        onCryptoClick={(symbol) => navigate(`/swap?from=${symbol}&to=USDT`)}
        isTransitioning={isTransitioning}
      />

      {!isAuthenticated && <FeaturesSection />}
      <FAQSection />
    </div>
  );
};

export default HomePage;