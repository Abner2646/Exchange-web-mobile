// src/hooks/useMarket.js  
import { useState } from 'react';
import { useQuery } from 'react-query';
import marketService from '../services/marketService';

export const useMarket = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const cryptosPerPage = 10;
  const totalPages = 10; // ⭐ MODIFICADO: Ahora son 10 páginas (100 cryptos / 10 por página)

  // ⭐ MODIFICADO: Query con 1 SOLA llamada de 100 cryptos
  const { 
    data: allMarketData = [], 
    isLoading: loadingMarketData,
    error: marketDataError,
    refetch: refetchMarketData,
  } = useQuery(
    'marketAllData', // ⭐ MODIFICADO: Nuevo key
    () => marketService.getAllMarketData(),
    {
      staleTime: 30000, // 30 segundos
      refetchInterval: 30000, // Auto-refresh cada 30 segundos
      onSuccess: (data) => {
        console.log(`useMarket: ${data.length} cryptos cargadas exitosamente`);
      },
      onError: (error) => {
        console.error('useMarket marketData error:', error);
      },
    }
  );

  // ⭐ MODIFICADO: Paginar los 100 cryptos en el frontend
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
      
      // Scroll suave a la tabla
      const targetElement = document.getElementById('markets-section');
      if (targetElement) {
        targetElement.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start' 
        });
      }
      
      setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
    }
  };

  return {
    // Data
    marketData,        // Para la tabla (10 cryptos paginados)
    allMarketData,     // Todos los 100 cryptos
    
    // Top Movers por timeframe (calculados desde 100 cryptos)
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
    totalPages, // ⭐ Ahora son 10 páginas
    isTransitioning,
    goToPage,
    
    // Actions
    refresh: refetchMarketData,
  };
};