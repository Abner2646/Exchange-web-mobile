// mobile/hooks/useBalances.js
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import balanceService from '../services/balanceService';
import cryptoService from '../services/cryptoService';

export const useBalances = (marketData = []) => { // ⭐ NUEVO parámetro
  const { user } = useAuth();
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [activeTab, setActiveTab] = useState('moneda');

  // Query para obtener balances del usuario
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
  });

  // Query para obtener criptomonedas relacionadas a los balances
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

  // Query para obtener precios de las criptomonedas
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

  // ⭐ NUEVO: Crear mapa de marketData por símbolo
  const marketDataMap = marketData.reduce((acc, coin) => {
    acc[coin.symbol.toUpperCase()] = coin;
    return acc;
  }, {});

  // Cálculo de totales en USDT y BTC
  const totals = balanceService.calculateTotals(balances, criptomonedas, prices);

  // Enriquecimiento de balances con información completa
  const enrichedBalances = balanceService.enrichBalances(balances, criptomonedas, prices, marketDataMap);

  // Balances para mostrar (con filtro de pequeños balances)
  const displayBalances = hideSmallBalances
    ? balanceService.filterSmallBalances(enrichedBalances, 1)
    : enrichedBalances;

  // Top assets para HomePage (TOP 3 para mobile) ⭐ MODIFICADO - pasar marketDataMap
  const topAssets = balanceService.getTopAssets(enrichedBalances, 3, marketDataMap);

  const isLoading = loadingBalances || loadingCryptos || loadingPrices;

  return {
    // Datos para HomePage
    portfolio: {
      totalUSDT: totals.totalUSDT,
      totalBTC: totals.totalBTC,
      btcPriceError: totals.btcPriceError,
    },
    topAssets,
    
    // Datos completos
    balances,
    criptomonedas,
    prices,
    enrichedBalances: displayBalances,
    
    // Totales
    totalUSDT: totals.totalUSDT,
    totalBTC: totals.totalBTC,
    btcPriceError: totals.btcPriceError,
    
    // Estados
    isLoading,
    error: balancesError,
    
    // Filtros
    activeTab,
    setActiveTab,
    hideSmallBalances,
    setHideSmallBalances,
    
    // Acciones
    refetch: refetchBalances,
  };
};