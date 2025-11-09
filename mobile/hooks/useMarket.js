// mobile/hooks/useMarket.js
/*
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import marketService from '../services/marketService';

export const useMarket = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const cryptosPerPage = 10;
  const totalPages = 10;

  // ⭐ SINTAXIS V5: useQuery con objeto
  const { 
    data: allMarketData = [], 
    isLoading: loadingMarketData,
    error: marketDataError,
    refetch: refetchMarketData,
  } = useQuery({
    queryKey: ['marketAllData'],
    queryFn: () => marketService.getAllMarketData(),
    staleTime: 30000,
    refetchInterval: 30000,
    retry: 1,
  });

  // Paginar los 100 cryptos en el frontend
  const startIndex = (currentPage - 1) * cryptosPerPage;
  const endIndex = startIndex + cryptosPerPage;
  const marketData = allMarketData.slice(startIndex, endIndex);

  console.log(`useMarket: Mostrando página ${currentPage}/${totalPages} (${marketData.length} cryptos)`);

  // Top Gainers 24h (calculados desde los 100 cryptos)
  const topGainers24h = marketService.getTopGainers(allMarketData, 5, '24h', 0.5);
  
  // Top Losers 24h
  const topLosers24h = marketService.getTopLosers(allMarketData, 5, '24h', 0.5);

  // Top Gainers 7d
  const topGainers7d = marketService.getTopGainers(allMarketData, 5, '7d', 0.5);
  
  // Top Losers 7d
  const topLosers7d = marketService.getTopLosers(allMarketData, 5, '7d', 0.5);

  const goToPage = (newPage) => {
    if (newPage !== currentPage && newPage >= 1 && newPage <= totalPages) {
      setIsTransitioning(true);
      setCurrentPage(newPage);
      
      setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
    }
  };

  return {
    // Data
    marketData,
    allMarketData,
    
    // Top Movers por timeframe
    topGainers24h,
    topLosers24h,
    topGainers7d,
    topLosers7d,
    
    // Loading states
    isLoading: loadingMarketData,
    
    // Errors
    marketDataError,
    
    // Pagination
    currentPage,
    totalPages,
    isTransitioning,
    goToPage,
    
    // Actions
    refresh: refetchMarketData,
  };
};

export default useMarket;
*/

// mobile/hooks/useMarket.js
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import marketService from '../services/marketService';

export const useMarket = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const cryptosPerPage = 10;
  const totalPages = 10; // 100 cryptos / 10 por página

  // Query con 1 SOLA llamada de 100 cryptos
  const { 
    data: allMarketData = [], 
    isLoading: loadingMarketData,
    error: marketDataError,
    refetch: refetchMarketData,
  } = useQuery({
    queryKey: ['marketAllData'],
    queryFn: () => marketService.getAllMarketData(),
    staleTime: 30000, // 30 segundos
    refetchInterval: 30000, // Auto-refresh cada 30 segundos
  });

  // Paginar los 100 cryptos en el frontend
  const startIndex = (currentPage - 1) * cryptosPerPage;
  const endIndex = startIndex + cryptosPerPage;
  const marketData = allMarketData.slice(startIndex, endIndex);

  // Top Gainers 24h
  const topGainers24h = marketService.getTopGainers(allMarketData, 5, '24h', 0.5);
  
  // Top Losers 24h
  const topLosers24h = marketService.getTopLosers(allMarketData, 5, '24h', 0.5);

  // Top Gainers 7d
  const topGainers7d = marketService.getTopGainers(allMarketData, 5, '7d', 0.5);
  
  // Top Losers 7d
  const topLosers7d = marketService.getTopLosers(allMarketData, 5, '7d', 0.5);

  const goToPage = (newPage) => {
    if (newPage !== currentPage && newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  return {
    // Data
    marketData,
    allMarketData,
    
    // Top Movers
    topGainers24h,
    topLosers24h,
    topGainers7d,
    topLosers7d,
    
    // Loading states
    isLoading: loadingMarketData,
    
    // Errors
    marketDataError,
    
    // Pagination
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    previousPage,
    
    // Actions
    refresh: refetchMarketData,
  };
};