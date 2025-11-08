// mobile/hooks/useBalances.js
import { useState, useEffect } from 'react'; // ⭐ Agregar useEffect
import { useQuery } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import balanceService from '../services/balanceService';
import cryptoService from '../services/cryptoService';

export const useBalances = () => {
  const { user } = useAuth();
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [activeTab, setActiveTab] = useState('moneda');

  // ⭐ LOG: Verificar si hay usuario
  console.log('[useBalances] Usuario:', user ? `${user.email} (ID: ${user.id})` : 'NO USER');

  const {
    data: balances = [],
    isLoading: loadingBalances,
    error: balancesError,
    refetch: refetchBalances,
  } = useQuery({
    queryKey: ['myBalances'],
    queryFn: () => balanceService.getMyBalances(),
    enabled: !!user,
    staleTime: 30000,
    gcTime: 300000,
    retry: 1,
  });

  // ⭐ LOG: Cuando cambian los balances
  useEffect(() => {
    if (!loadingBalances) {
      console.log('=== BALANCES HOOK ===');
      console.log('Balances:', balances);
      console.log('Cantidad:', balances?.length);
      console.log('Error:', balancesError?.message);
      console.log('====================');
    }
  }, [balances, loadingBalances, balancesError]);

  // ⭐ SINTAXIS V5: Query con dependencias dinámicas
  const {
    data: criptomonedas = [],
    isLoading: loadingCryptos,
  } = useQuery({
    queryKey: ['cryptosForBalances', balances],
    queryFn: async () => {
      if (balances.length === 0) return [];

      const cryptoIds = [...new Set(balances.map(b => b.criptomonedaId))];
      
      if (cryptoIds.length === 0) return [];

      const cryptoData = await cryptoService.getCryptosByIds(cryptoIds);
      
      return cryptoData;
    },
    enabled: !!user && balances.length > 0,
    staleTime: 60000,
  });

  // ⭐ SINTAXIS V5: Query con múltiples dependencias
  const {
    data: prices = {},
    isLoading: loadingPrices,
  } = useQuery({
    queryKey: ['pricesForBalances', criptomonedas],
    queryFn: async () => {
      if (criptomonedas.length === 0) return {};

      const cryptosToFetch = [...criptomonedas];
      const hasBTC = criptomonedas.some(c => c.symbol === 'BTC');

      if (!hasBTC) {
        const btcData = await cryptoService.getCryptoBySymbol('BTC');
        if (btcData) {
          cryptosToFetch.push(btcData);
        }
      }

      const pricesMap = await cryptoService.getPricesForCryptos(cryptosToFetch, 'USDT');
      
      return pricesMap;
    },
    enabled: !!user && criptomonedas.length > 0,
    staleTime: 30000,
  });

  // Cálculo de totales en USDT y BTC
  const totals = balanceService.calculateTotals(balances, criptomonedas, prices);

  // Enriquecimiento de balances con información completa
  const enrichedBalances = balanceService.enrichBalances(balances, criptomonedas, prices);

  // Balances para mostrar (con filtro de pequeños balances)
  const displayBalances = hideSmallBalances
    ? balanceService.filterSmallBalances(enrichedBalances, 1)
    : enrichedBalances;

  // Top assets para HomePage (con porcentajes calculados)
  const topAssets = balanceService.getTopAssets(enrichedBalances, 5);

  const isLoading = loadingBalances || loadingCryptos || loadingPrices;

  return {
    // Datos para HomePage
    portfolio: {
      totalUSDT: totals.totalUSDT,
      totalBTC: totals.totalBTC,
      btcPriceError: totals.btcPriceError,
    },
    topAssets,
    
    // Datos para BalancePage
    balances,
    criptomonedas,
    prices,
    enrichedBalances: displayBalances,
    
    // Totales (disponibles directamente)
    totalUSDT: totals.totalUSDT,
    totalBTC: totals.totalBTC,
    btcPriceError: totals.btcPriceError,
    
    // Estados de carga y error
    isLoading,
    error: balancesError,
    
    // Filtros y tabs
    activeTab,
    setActiveTab,
    hideSmallBalances,
    setHideSmallBalances,
    
    // Acciones
    refetch: refetchBalances,
  };
};

export default useBalances;