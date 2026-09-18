// src/hooks/useBalances.js (web)  
import { useState } from 'react';
import { useQuery } from 'react-query';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext'; // ⭐ AGREGADO
import balanceService from '../services/balanceService';
import cryptoService from '../services/cryptoService';

export const useBalances = () => {
  const { user } = useAuth(); // ⭐ AGREGADO
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [activeTab, setActiveTab] = useState('moneda');

  // Query para obtener balances del usuario
  const {
    data: balances = [],
    isLoading: loadingBalances,
    error: balancesError,
    refetch: refetchBalances,
  } = useQuery(
    'myBalances',
    () => balanceService.getMyBalances(),
    {
      enabled: !!user, // ⭐ AGREGADO - Solo ejecutar si hay usuario
      staleTime: 30000, // 30 segundos
      cacheTime: 300000, // 5 minutos
      onError: (error) => {
        console.error('Error al cargar balances:', error);
        toast.error('Error al cargar balances');
      },
    }
  );

  // Query para obtener criptomonedas relacionadas a los balances
  const {
    data: criptomonedas = [],
    isLoading: loadingCryptos,
  } = useQuery(
    ['cryptosForBalances', balances],
    async () => {
      if (balances.length === 0) return [];

      // Si los balances ya traen la crypto adjunta por el backend
      const directCryptos = balances.map(b => b.crypto).filter(Boolean);
      if (directCryptos.length === balances.length) {
        return directCryptos;
      }

      // Extraer IDs únicos de criptomonedas que el usuario tiene
      const cryptoIds = [...new Set(balances.map(b => b.criptomonedaId || b.cryptoId || b.crypto?.id).filter(Boolean))];
      
      if (cryptoIds.length === 0) return [];

      // Obtener solo las criptomonedas que tiene el usuario
      const cryptoData = await cryptoService.getCryptosByIds(cryptoIds);
      
      return cryptoData;
    },
    {
      enabled: !!user && balances.length > 0,
      staleTime: 60000,
    }
  );

  // Query para obtener precios de las criptomonedas
  const {
    data: prices = {},
    isLoading: loadingPrices,
  } = useQuery(
    ['pricesForBalances', criptomonedas, balances],
    async () => {
      // Unir todas las criptos conocidas (desde query o desde balances directamente)
      const allKnownCryptos = [...criptomonedas];
      for (const b of balances) {
        if (b.crypto && !allKnownCryptos.some(c => c.symbol === b.crypto.symbol)) {
          allKnownCryptos.push(b.crypto);
        }
      }

      // Siempre incluir BTC para el cálculo del balance total
      const hasBTC = allKnownCryptos.some(c => c.symbol === 'BTC');
      if (!hasBTC) {
        allKnownCryptos.push({ symbol: 'BTC' });
      }

      if (allKnownCryptos.length === 0) return {};

      // Obtener precios en paralelo
      const pricesMap = await cryptoService.getPricesForCryptos(allKnownCryptos, 'USDT');
      
      return pricesMap;
    },
    {
      enabled: !!user,
      staleTime: 30000,
    }
  );

  // Cálculo de totales en USDT y BTC
  const totals = balanceService.calculateTotals(balances, criptomonedas, prices);

  // Enriquecimiento de balances con información completa
  const enrichedBalances = balanceService.enrichBalances(balances, criptomonedas, prices);

  // Balances para mostrar en BalancePage (con filtro de pequeños balances)
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
    
    // Filtros y tabs para BalancePage
    activeTab,
    setActiveTab,
    hideSmallBalances,
    setHideSmallBalances,
    
    // Acciones
    refetch: refetchBalances,
  };
};