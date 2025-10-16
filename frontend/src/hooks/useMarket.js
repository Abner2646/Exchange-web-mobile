// src/hooks/useMarket.js
import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import marketService from '../services/marketService';

export const useMarket = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const cryptosPerPage = 10;
  const totalPages = 3;

  const { 
    data: marketData = [], 
    isLoading,
    refetch 
  } = useQuery(
    ['market', currentPage],
    () => marketService.getMarketData(currentPage, cryptosPerPage),
    {
      staleTime: 30000,
      refetchInterval: 30000,
    }
  );

  const goToPage = (newPage) => {
    if (newPage !== currentPage && newPage >= 1 && newPage <= totalPages) {
      setIsTransitioning(true);
      setCurrentPage(newPage);
      
      // Scroll suave a la tabla
      setTimeout(() => {
        document.getElementById('markets-section')?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start' 
        });
        setIsTransitioning(false);
      }, 300);
    }
  };

  return {
    marketData,
    isLoading,
    currentPage,
    totalPages,
    isTransitioning,
    goToPage,
    refresh: refetch,
  };
};