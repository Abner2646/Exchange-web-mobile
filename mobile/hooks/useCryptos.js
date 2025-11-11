// hooks/useCryptos.js (mobile)
/*import { useQuery } from "@tanstack/react-query"
import { cryptoService } from "../services/cryptoService"

export const useCryptos = () => {
  const {
    data: cryptos = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["active-cryptos"],
    queryFn: () => cryptoService.getActiveCryptos(),
    staleTime: 300000, // 5 minutos
    gcTime: 600000, // 10 minutos
  })

  return {
    cryptos,
    isLoading,
    error,
  }
}
*/

// hooks/useCryptos.js
import { useQuery } from "@tanstack/react-query"
import cryptoService from "../services/cryptoService"

export const useCryptos = () => {
  console.log('🔵 [useCryptos] cryptoService:', cryptoService);
  
  if (!cryptoService) {
    console.error('🔴 [useCryptos] cryptoService es undefined');
    return {
      cryptos: [],
      isLoading: false,
      error: new Error('Servicio de cryptos no disponible'),
      refetch: () => {},
    };
  }

  const {
    data: cryptos = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["active-cryptos"],
    queryFn: () => {
      console.log('🔵 [useCryptos] Ejecutando query...');
      return cryptoService.getActiveCryptos();
    },
    staleTime: 300000,
    gcTime: 600000,
  })

  console.log('🔵 [useCryptos] Query result:', { 
    cryptosCount: cryptos?.length, 
    isLoading, 
    error: error?.message 
  });

  return {
    cryptos,
    isLoading,
    error,
    refetch,
  }
}