// src/hooks/useCryptos.js (web)
import { useQuery } from 'react-query';
import cryptoService from '../services/cryptoService';

export const useCryptos = () => {
  const { 
    data: cryptos = [], 
    isLoading,
    error 
  } = useQuery(
    'active-cryptos',
    () => cryptoService.getActiveCryptos(),
    {
      staleTime: 300000, // 5 minutos
      cacheTime: 600000, // 10 minutos
    }
  );

  return {
    cryptos,
    isLoading,
    error,
  };
};