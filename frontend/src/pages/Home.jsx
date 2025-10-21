// src/pages/Home.jsx
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBalances } from '../hooks/useBalances';
import { useMarket } from '../hooks/useMarket';
import HeroSection from '../components/features/HeroSection';
import BalanceCard from '../components/features/BalanceCard';
import TopAssets from '../components/features/TopAssets';
import TopGainersSection from '../components/features/TopGainersSection';
import MarketTable from '../components/features/MarketTable';
import DownloadSection from '../components/features/DownloadSection';
import TrustBadgesSection from '../components/features/TrustBadgesSection';
import FeaturesSection from '../components/features/FeaturesSection';
import FAQSection from '../components/features/FAQSection';
import '../styles/HomePage.css';

const HomePage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const {
    portfolio,
    topAssets,
    isLoading: loadingBalances,
  } = useBalances();

  const {
    marketData,
    isLoading: loadingMarket,
    currentPage,
    totalPages,
    goToPage,
    isTransitioning,
  } = useMarket();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) {
    return (
      <div className="home-page">
        <DownloadSection />
        <TrustBadgesSection />
      </div>
    );
  }

  return (
    <div className="home-page">
      {!isAuthenticated ? (
        <>
          <HeroSection onNavigate={navigate} />

          {/* TOP GAINERS (arriba de la tabla) */}
          <TopGainersSection 
            onCryptoClick={(symbol) => navigate(`/swap?from=${symbol}&to=USDT`)}
          />

          {/* MARKET TABLE */}
          <MarketTable
            data={marketData}
            loading={loadingMarket}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            onCryptoClick={(symbol) => navigate(`/swap?from=${symbol}&to=USDT`)}
            isTransitioning={isTransitioning}
          />

          <DownloadSection />
          <FeaturesSection />
          <FAQSection />
          <TrustBadgesSection />
        </>
      ) : (
        <>
          <section className="dashboard-section">
            <div className="dashboard-grid">
              <BalanceCard
                totalUSDT={portfolio.totalUSDT}
                totalBTC={portfolio.totalBTC}
                btcPriceError={portfolio.btcPriceError}
                onNavigate={navigate}
                isLoading={loadingBalances}
              />
              <TopAssets 
                assets={topAssets} 
                onNavigate={navigate}
                isLoading={loadingBalances}
              />
            </div>
          </section>

          {/* TOP GAINERS (debajo de portfolio, 4 columnas) */}
          <TopGainersSection 
            onCryptoClick={(symbol) => navigate(`/swap?from=${symbol}&to=USDT`)}
          />

          {/* MARKET TABLE */}
          <MarketTable
            data={marketData}
            loading={loadingMarket}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={goToPage}
            onCryptoClick={(symbol) => navigate(`/swap?from=${symbol}&to=USDT`)}
            isTransitioning={isTransitioning}
          />

          <DownloadSection />
          <TrustBadgesSection />
          <FAQSection />
        </>
      )}
    </div>
  );
};

export default HomePage;