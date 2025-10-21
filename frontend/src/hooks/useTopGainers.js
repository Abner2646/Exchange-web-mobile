// src/hooks/useTopGainers.js
import { useQuery } from 'react-query';
import axios from 'axios';
import { ENDPOINTS } from '../api/endpoints';

const fetchTopGainers = async () => {
  try {
    // Obtener top 100 para tener más opciones de gainers
    const response = await axios.get(ENDPOINTS.COINGECKO_MARKETS(1, 100));
    const data = response.data;
    
    // Filtrar solo las que subieron más de 3%
    const gainers = data
      .filter(coin => coin.price_change_percentage_24h > 3)
      .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
      .slice(0, 10); // Máximo 10
    
    // Asegurar que sean pares (si son 9, tomar solo 8)
    const evenCount = gainers.length % 2 === 0 ? gainers.length : gainers.length - 1;
    
    return gainers.slice(0, evenCount);
  } catch (error) {
    console.error('Error fetching top gainers:', error);
    throw error;
  }
};

export const useTopGainers = () => {
  const {
    data: gainers = [],
    isLoading,
    error,
  } = useQuery('topGainers', fetchTopGainers, {
    staleTime: 60000, // 1 minuto
    refetchInterval: 60000, // Refetch cada minuto
    retry: 2,
    onError: (error) => {
      console.error('Top gainers query error:', error);
    },
  });

  const hasGainers = gainers.length > 0;

  return {
    gainers,
    isLoading,
    error,
    hasGainers,
  };
};

export default useTopGainers;