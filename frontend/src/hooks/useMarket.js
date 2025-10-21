// src/hooks/useMarket.js (ACTUALIZAR - eliminar query de globalStats)
import { useState } from 'react';
import { useQuery } from 'react-query';
import marketService from '../services/marketService';

export const useMarket = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const cryptosPerPage = 10;
  const totalPages = 3;

  // Query: Obtener 3 páginas de market data
  const { 
    data: allMarketData = [], 
    isLoading: loadingMarketData,
    error: marketDataError,
    refetch: refetchMarketData,
  } = useQuery(
    'marketAllPages',
    () => marketService.getMultiplePages(3, 10),
    {
      staleTime: 30000, // 30 segundos
      refetchInterval: 30000,
      onError: (error) => {
        console.error('useMarket marketData error:', error);
      },
    }
  );

  // Paginar los datos para la tabla
  const startIndex = (currentPage - 1) * cryptosPerPage;
  const endIndex = startIndex + cryptosPerPage;
  const marketData = allMarketData.slice(startIndex, endIndex);

  // Top Gainers 24h (con filtros)
  const topGainers24h = marketService.getTopGainers(allMarketData, 5, '24h', 0.5);
  
  // Top Losers 24h (con filtros)
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
    marketData,        // Para la tabla (paginada)
    allMarketData,     // Todos los datos
    
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