// mobile/hooks/useBalances.js
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import balanceService from '../services/balanceService';
import cryptoService from '../services/cryptoService';

export const useBalances = () => {
  const { user } = useAuth();
  const [hideSmallBalances, setHideSmallBalances] = useState(false);

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
    staleTime: 30000, // 30 segundos
    gcTime: 300000, // 5 minutos (era cacheTime en v4)
  });

  // Query para obtener criptomonedas relacionadas a los balances
  const {
    data: criptomonedas = [],
    isLoading: loadingCryptos,
  } = useQuery({
    queryKey: ['cryptosForBalances', balances],
    queryFn: async () => {
      if (balances.length === 0) return [];

      // Extraer IDs únicos de criptomonedas que el usuario tiene
      const cryptoIds = [...new Set(balances.map(b => b.criptomonedaId))];
      
      if (cryptoIds.length === 0) return [];

      // Obtener solo las criptomonedas que tiene el usuario
      const cryptoData = await cryptoService.getCryptosByIds(cryptoIds);
      
      return cryptoData;
    },
    enabled: !!user && balances.length > 0,
    staleTime: 60000, // 1 minuto
  });

  // Query para obtener precios de las criptomonedas
  const {
    data: prices = {},
    isLoading: loadingPrices,
  } = useQuery({
    queryKey: ['pricesForBalances', criptomonedas],
    queryFn: async () => {
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
    enabled: !!user && criptomonedas.length > 0,
    staleTime: 30000, // 30 segundos
  });

  // Query para obtener datos de mercado (precios + variaciones 24h) desde CoinGecko
  const {
    data: marketData = {},
    isLoading: loadingMarketData,
  } = useQuery({
    queryKey: ['marketDataForBalances', criptomonedas],
    queryFn: async () => {
      if (criptomonedas.length === 0) return {};

      try {
        console.log('🔍 Obteniendo datos de mercado de CoinGecko...');
        // Obtener datos de CoinGecko (top 250 cryptos con variación 24h)
        const response = await cryptoService.getMarketData(250);
        console.log('📊 Respuesta de CoinGecko:', response.length, 'cryptos');
        
        // Crear mapa: symbol -> market data
        const marketMap = {};
        response.forEach(coin => {
          const symbol = coin.symbol.toUpperCase();
          marketMap[symbol] = {
            priceChange24h: coin.price_change_percentage_24h || 0,
            currentPrice: coin.current_price || 0,
            high24h: coin.high_24h || 0,
            low24h: coin.low_24h || 0,
          };
        });

        console.log('✅ Market data mapeado:', Object.keys(marketMap).length, 'cryptos');
        console.log('📝 Ejemplo BTC:', marketMap['BTC']);
        console.log('📝 Ejemplo USDT:', marketMap['USDT']);

        return marketMap;
      } catch (error) {
        console.error('❌ Error obteniendo datos de mercado:', error);
        return {};
      }
    },
    enabled: !!user && criptomonedas.length > 0,
    staleTime: 60000, // 1 minuto
  });

  // Cálculo de totales en USDT y BTC
  const totals = balanceService.calculateTotals(balances, criptomonedas, prices);

  // Enriquecimiento de balances con información completa (incluyendo marketData)
  // ⭐ USAR USEMEMO para recalcular cuando marketData cambie
  const enrichedBalances = useMemo(() => {
    console.log('🔄 Recalculando enrichedBalances con marketData:', Object.keys(marketData).length, 'cryptos');
    return balanceService.enrichBalances(balances, criptomonedas, prices, marketData);
  }, [balances, criptomonedas, prices, marketData]);

  // Top assets para HomePage (usar todos los balances sin filtrar)
  const topAssets = useMemo(() => {
    return balanceService.getTopAssets(enrichedBalances, 5);
  }, [enrichedBalances]);

  // Balances para mostrar en Assets (con filtro de pequeños balances)
  const displayBalances = useMemo(() => {
    return hideSmallBalances
      ? balanceService.filterSmallBalances(enrichedBalances, 1)
      : enrichedBalances;
  }, [enrichedBalances, hideSmallBalances]);

  const isLoading = loadingBalances || loadingCryptos || loadingPrices || loadingMarketData;

  return {
    // Datos para HomePage
    portfolio: {
      totalUSDT: totals.totalUSDT,
      totalBTC: totals.totalBTC,
      btcPriceError: totals.btcPriceError,
    },
    topAssets,
    
    // Datos
    balances,
    criptomonedas,
    prices,
    enrichedBalances: displayBalances,
    
    // Totales
    totalUSDT: totals.totalUSDT,
    totalBTC: totals.totalBTC,
    btcPriceError: totals.btcPriceError,
    
    // Estados de carga y error
    isLoading,
    error: balancesError,
    
    // Filtros
    hideSmallBalances,
    setHideSmallBalances,
    
    // Acciones
    refetch: refetchBalances,
  };
};