// src/hooks/useBalances.js
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

      // Extraer IDs únicos de criptomonedas que el usuario tiene
      const cryptoIds = [...new Set(balances.map(b => b.criptomonedaId))];
      
      if (cryptoIds.length === 0) return [];

      // Obtener solo las criptomonedas que tiene el usuario
      const cryptoData = await cryptoService.getCryptosByIds(cryptoIds);
      
      return cryptoData;
    },
    {
      enabled: !!user && balances.length > 0, // ⭐ MODIFICADO - Agregar verificación de usuario
      staleTime: 60000, // 1 minuto
    }
  );

  // Query para obtener precios de las criptomonedas
  const {
    data: prices = {},
    isLoading: loadingPrices,
  } = useQuery(
    ['pricesForBalances', criptomonedas],
    async () => {
      if (criptomonedas.length === 0) return {};

      // Siempre incluir BTC para el cálculo del balance total
      const cryptosToFetch = [...criptomonedas];
      const hasBTC = criptomonedas.some(c => c.symbol === 'BTC');

      // Si no tiene BTC en su balance, agregarlo para obtener su precio
      if (!hasBTC) {
        const btcData = await cryptoService.getCryptoBySymbol('BTC');
        if (btcData) {
          cryptosToFetch.push(btcData);
        }
      }

      // Obtener precios en paralelo
      const pricesMap = await cryptoService.getPricesForCryptos(cryptosToFetch, 'USDT');
      
      return pricesMap;
    },
    {
      enabled: !!user && criptomonedas.length > 0, // ⭐ MODIFICADO - Agregar verificación de usuario
      staleTime: 30000, // 30 segundos
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