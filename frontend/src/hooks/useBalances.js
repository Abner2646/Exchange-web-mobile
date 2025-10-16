// src/hooks/useBalances.js
/*
import { useQuery, useQueryClient } from 'react-query';
import balanceService from '../services/balanceService';
import cryptoService from '../services/cryptoService';

export const useBalances = () => {
  const queryClient = useQueryClient();

  // Obtener balances
  const { 
    data: balances = [], 
    isLoading: loadingBalances,
    error: balancesError,
    refetch: refetchBalances 
  } = useQuery(
    'balances',
    () => balanceService.getMyBalances(),
    {
      staleTime: 30000, // 30 segundos
      cacheTime: 300000, // 5 minutos
    }
  );

  // Obtener cryptos relacionadas
  const cryptoIds = [...new Set(balances.map(b => b.criptomonedaId))];
  
  const { 
    data: cryptos = [], 
    isLoading: loadingCryptos 
  } = useQuery(
    ['cryptos', cryptoIds],
    () => cryptoService.getCryptosByIds(cryptoIds),
    {
      enabled: cryptoIds.length > 0,
      staleTime: 60000, // 1 minuto
    }
  );

  // Obtener precios
  const symbols = cryptos.map(c => c.symbol);
  const { 
    data: prices = {}, 
    isLoading: loadingPrices 
  } = useQuery(
    ['prices', symbols],
    () => cryptoService.getPrices(symbols),
    {
      enabled: symbols.length > 0,
      refetchInterval: 30000, // Auto-refresh cada 30 seg
      staleTime: 20000,
    }
  );

  // Calcular portfolio
  const portfolio = balanceService.calculatePortfolioValue(balances, cryptos, prices);
  const topAssets = balanceService.getTopAssets(balances, cryptos, prices);

  // Refetch manual
  const refresh = () => {
    queryClient.invalidateQueries('balances');
    queryClient.invalidateQueries(['prices']);
  };

  return {
    balances,
    cryptos,
    prices,
    portfolio,
    topAssets,
    isLoading: loadingBalances || loadingCryptos || loadingPrices,
    error: balancesError,
    refresh,
    refetchBalances,
  };
};
*/

// Código de arriba era el anteriorimport

import { useState } from 'react';
import { useQuery } from 'react-query';
import { toast } from 'react-hot-toast';
import balanceService from '../services/balanceService';
import cryptoService from '../services/cryptoService';

export const useBalances = () => {
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [activeTab, setActiveTab] = useState('moneda');

  // Query para obtener balances
  const {
    data: balances = [],
    isLoading: loadingBalances,
    error: balancesError,
    refetch: refetchBalances,
  } = useQuery(
    'myBalances',
    () => balanceService.getMyBalances(),
    {
      staleTime: 30000, // 30 segundos
      cacheTime: 300000, // 5 minutos
      onError: (error) => {
        console.error('Error al cargar balances:', error);
        toast.error('Error al cargar balances');
      },
    }
  );

  // Query para obtener criptomonedas (depende de balances)
  const {
    data: criptomonedas = [],
    isLoading: loadingCryptos,
  } = useQuery(
    ['cryptosForBalances', balances],
    async () => {
      if (balances.length === 0) return [];

      // Extraer IDs únicos de criptomonedas que el usuario TIENE
      const cryptoIds = [...new Set(balances.map(b => b.criptomonedaId))];
      console.log('IDs de criptos con balance:', cryptoIds);

      if (cryptoIds.length === 0) return [];

      // Obtener SOLO las criptomonedas que tiene el usuario
      const cryptoData = await cryptoService.getCryptosByIds(cryptoIds);
      console.log('Criptomonedas obtenidas:', cryptoData);
      
      return cryptoData;
    },
    {
      enabled: balances.length > 0,
      staleTime: 60000, // 1 minuto
    }
  );

  // Query para obtener precios (depende de criptomonedas)
  const {
    data: prices = {},
    isLoading: loadingPrices,
  } = useQuery(
    ['pricesForBalances', criptomonedas],
    async () => {
      if (criptomonedas.length === 0) return {};

      // SIEMPRE obtener precio de BTC para el cálculo del balance total
      const cryptosToFetch = [...criptomonedas];
      const hasBTC = criptomonedas.some(c => c.symbol === 'BTC');

      // Si no tiene BTC, agregarlo para obtener su precio
      if (!hasBTC) {
        const btcData = await cryptoService.getCryptoBySymbol('BTC');
        if (btcData) {
          cryptosToFetch.push(btcData);
        }
      }

      // Obtener todos los precios en paralelo
      const pricesMap = await cryptoService.getPricesForCryptos(cryptosToFetch, 'USDT');
      console.log('Precios obtenidos:', pricesMap);
      
      return pricesMap;
    },
    {
      enabled: criptomonedas.length > 0,
      staleTime: 30000, // 30 segundos
    }
  );

  // Cálculo de totales
  const totals = balanceService.calculateTotals(balances, criptomonedas, prices);

  // Enriquecimiento de balances
  const enrichedBalances = balanceService.enrichBalances(balances, criptomonedas, prices);

  // Filtrado de balances pequeños (para BalancePage)
  const displayBalances = hideSmallBalances
    ? balanceService.filterSmallBalances(enrichedBalances, 1)
    : enrichedBalances;

  // Top assets para HomePage (ordenados por valor en USDT, top 5)
  const topAssets = enrichedBalances
    .sort((a, b) => b.valueInUSDT - a.valueInUSDT)
    .slice(0, 5);

  const isLoading = loadingBalances || loadingCryptos || loadingPrices;

  return {
    // Datos para HomePage (formato portfolio)
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
    
    // Totales (también disponibles directamente)
    totalUSDT: totals.totalUSDT,
    totalBTC: totals.totalBTC,
    btcPriceError: totals.btcPriceError,
    
    // Estados
    isLoading,
    error: balancesError,
    
    // Filtros y tabs (para BalancePage)
    activeTab,
    setActiveTab,
    hideSmallBalances,
    setHideSmallBalances,
    
    // Acciones
    refetch: refetchBalances,
  };
};