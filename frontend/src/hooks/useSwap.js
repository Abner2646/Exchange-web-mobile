// src/hooks/useSwap.js
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import swapService from '../services/swapService';
import cryptoService from '../services/cryptoService';
import { useCryptos } from './useCrypto';
import { useBalances } from './useBalances';
import { validateSwapForm } from '../utils/validators';

export const useSwap = () => {
  const queryClient = useQueryClient();

  // Estados locales del swap
  const [fromCrypto, setFromCrypto] = useState(null);
  const [toCrypto, setToCrypto] = useState(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState(null);
  const [isPairValid, setIsPairValid] = useState(true);
  const [priceLoading, setPriceLoading] = useState(false);

  // Reutilizar hooks existentes con React Query
  const { cryptos, isLoading: cryptosLoading } = useCryptos();
  const { balances, refetch: refetchBalances, isLoading: balancesLoading } = useBalances();

  console.log('[useSwap] State:', {
    fromCrypto: fromCrypto?.symbol,
    toCrypto: toCrypto?.symbol,
    fromAmount,
    toAmount,
    exchangeRate,
    isPairValid,
  });

  // Pre-seleccionar USDT y BTC al cargar
  useEffect(() => {
    if (cryptos.length > 0 && !fromCrypto && !toCrypto) {
      const usdt = cryptos.find((c) => c.symbol === 'USDT');
      const btc = cryptos.find((c) => c.symbol === 'BTC');

      if (usdt) setFromCrypto(usdt);
      if (btc) setToCrypto(btc);

      console.log('[useSwap] Pre-selected cryptos:', { usdt: usdt?.symbol, btc: btc?.symbol });
    }
  }, [cryptos, fromCrypto, toCrypto]);

  // Obtener balance de una criptomoneda
  const getBalance = (symbol) => {
    if (!symbol || !balances.length || !cryptos.length) return 0;

    const crypto = cryptos.find((c) => c.symbol === symbol);
    if (!crypto) return 0;

    const balance = balances.find((b) => b.criptomonedaId === crypto.id);
    if (!balance) return 0;

    const disponible =
      balance.balanceDisponible || balance.disponible || balance.saldoDisponible || 0;

    return parseFloat(disponible) || 0;
  };

  // Validar y obtener precio cuando cambian cryptos o cantidad
  useEffect(() => {
    if (!fromCrypto || !toCrypto || !fromAmount || parseFloat(fromAmount) <= 0) {
      setToAmount('');
      setExchangeRate(null);
      return;
    }

    if (fromCrypto.id === toCrypto.id) {
      setIsPairValid(false);
      setToAmount('');
      setExchangeRate(null);
      return;
    }

    // Debounce para evitar demasiadas llamadas
    const timeoutId = setTimeout(async () => {
      setPriceLoading(true);
      try {
        // Primero verificar si el par existe
        const pair = await swapService.getExchangePair(fromCrypto.symbol, toCrypto.symbol);
        
        if (!pair || !pair.activo) {
          setIsPairValid(false);
          setToAmount('');
          setExchangeRate(null);
          setPriceLoading(false);
          return;
        }

        setIsPairValid(true);

        // Obtener precio actual
        const price = await swapService.getCurrentPrice(fromCrypto.symbol, toCrypto.symbol);

        if (!price || price <= 0) {
          throw new Error('No se pudo obtener el precio');
        }

        const calculatedAmount = parseFloat(fromAmount) * price;
        setToAmount(calculatedAmount.toFixed(8));
        setExchangeRate(price);
      } catch (error) {
        console.error('[useSwap] Error getting price:', error);
        
        // Intentar par inverso
        try {
          const inversePair = await swapService.getExchangePair(toCrypto.symbol, fromCrypto.symbol);
          
          if (inversePair && inversePair.activo) {
            setIsPairValid(true);
            const inversePrice = await swapService.getCurrentPrice(toCrypto.symbol, fromCrypto.symbol);
            
            if (inversePrice > 0) {
              const price = 1 / inversePrice;
              const calculatedAmount = parseFloat(fromAmount) * price;
              setToAmount(calculatedAmount.toFixed(8));
              setExchangeRate(price);
            }
          } else {
            setIsPairValid(false);
            setToAmount('');
            setExchangeRate(null);
          }
        } catch (inverseError) {
          setIsPairValid(false);
          setToAmount('');
          setExchangeRate(null);
        }
      } finally {
        setPriceLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [fromCrypto, toCrypto, fromAmount]);

  // Mutation para ejecutar swap
  const executeSwapMutation = useMutation(
    async () => {
      console.log('[useSwap] Executing swap mutation');

      // Validar formulario
      const validation = validateSwapForm({
        fromCrypto,
        toCrypto,
        fromAmount,
        balance: getBalance(fromCrypto.symbol),
      });

      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        throw new Error(firstError);
      }

      if (!isPairValid) {
        throw new Error(`El par ${fromCrypto.symbol}/${toCrypto.symbol} no está disponible`);
      }

      // Obtener par de exchange
      const pair = await swapService.getExchangePair(fromCrypto.symbol, toCrypto.symbol);

      if (!pair) {
        throw new Error(`Par de intercambio ${fromCrypto.symbol}/${toCrypto.symbol} no encontrado`);
      }

      // Ejecutar swap
      const result = await swapService.executeSwap(pair.id, parseFloat(fromAmount), 'venta');

      return result;
    },
    {
      onSuccess: () => {
        console.log('[useSwap] Swap executed successfully');
        
        // Invalidar queries de balances
        queryClient.invalidateQueries('myBalances');
        
        // Refetch balances
        refetchBalances();

        // Limpiar formulario
        setFromAmount('');
        setToAmount('');
        setExchangeRate(null);

        toast.success('¡Intercambio realizado exitosamente!');
      },
      onError: (error) => {
        console.error('[useSwap] Error executing swap:', error);
        const errorMessage =
          error.response?.data?.error || error.message || 'Error al ejecutar el intercambio';
        toast.error(errorMessage);
      },
    }
  );

  // Handlers
  const handleFromCryptoChange = (crypto) => {
    console.log('[useSwap] From crypto changed:', crypto.symbol);
    setFromCrypto(crypto);

    if (toCrypto && crypto.id === toCrypto.id) {
      setToCrypto(null);
    }

    setFromAmount('');
    setToAmount('');
    setExchangeRate(null);
    setIsPairValid(true);
  };

  const handleToCryptoChange = (crypto) => {
    console.log('[useSwap] To crypto changed:', crypto.symbol);
    setToCrypto(crypto);

    if (fromCrypto && crypto.id === fromCrypto.id) {
      setFromCrypto(null);
    }

    setFromAmount('');
    setToAmount('');
    setExchangeRate(null);
    setIsPairValid(true);
  };

  const handleFromAmountChange = (value) => {
    console.log('[useSwap] Amount changed:', value);
    setFromAmount(value);
  };

  const handleSwapCryptos = () => {
    console.log('[useSwap] Swapping cryptos');
    const temp = fromCrypto;
    setFromCrypto(toCrypto);
    setToCrypto(temp);
    setFromAmount('');
    setToAmount('');
    setExchangeRate(null);
  };

  const handleUseMaxBalance = () => {
    if (fromCrypto) {
      const maxBalance = getBalance(fromCrypto.symbol);
      console.log('[useSwap] Using max balance:', maxBalance);
      setFromAmount(maxBalance.toString());
    }
  };

  // Filtros de criptomonedas disponibles
  const getAvailableFromCryptos = () => {
    if (!toCrypto) return cryptos;
    return cryptos.filter((crypto) => crypto.id !== toCrypto.id);
  };

  const getAvailableToCryptos = () => {
    if (!fromCrypto) return cryptos;
    return cryptos.filter((crypto) => crypto.id !== fromCrypto.id);
  };

  // Computed values
  const hasInsufficientBalance =
    fromAmount && fromCrypto ? parseFloat(fromAmount) > getBalance(fromCrypto.symbol) : false;
  const isSameCurrency = !!(fromCrypto && toCrypto && fromCrypto.id === toCrypto.id);
  const isLoading = cryptosLoading || balancesLoading;

  return {
    // Datos
    cryptos,
    balances,
    fromCrypto,
    toCrypto,
    fromAmount,
    toAmount,
    exchangeRate,
    isPairValid,

    // Estados de carga
    isLoading,
    priceLoading,
    isExecuting: executeSwapMutation.isLoading,

    // Funciones
    getBalance,
    getAvailableFromCryptos,
    getAvailableToCryptos,

    // Handlers
    handleFromCryptoChange,
    handleToCryptoChange,
    handleFromAmountChange,
    handleSwapCryptos,
    handleUseMaxBalance,

    // Acciones
    executeSwap: executeSwapMutation.mutate,

    // Validaciones
    hasInsufficientBalance,
    isSameCurrency,
  };
};

export default useSwap;