// src/hooks/useSwap.js (web)
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
  const [feeAmount, setFeeAmount] = useState('0');
  const [feePercent, setFeePercent] = useState('0.1');
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
    if (!symbol || !balances.length) return 0;

    const balance = balances.find((b) => 
      b.crypto?.symbol === symbol ||
      b.symbol === symbol ||
      (cryptos.length && b.criptomonedaId === cryptos.find((c) => c.symbol === symbol)?.id)
    );
    if (!balance) return 0;

    const disponible =
      balance.availableBalance ??
      balance.balanceDisponible ??
      balance.disponible ??
      balance.saldoDisponible ??
      balance.compartments?.funding?.available ??
      0;

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
      setFeeAmount('0');
      return;
    }

    // Debounce para evitar demasiadas llamadas
    const timeoutId = setTimeout(async () => {
      setPriceLoading(true);
      try {
        // Primero verificar si el par existe
        const pair = await swapService.getExchangePair(fromCrypto.symbol, toCrypto.symbol);
        const isPairActive = pair && (pair.active !== undefined ? pair.active : (pair.activo !== undefined ? pair.activo : true));
        
        if (!pair || !isPairActive) {
          setIsPairValid(false);
          setToAmount('');
          setExchangeRate(null);
          setFeeAmount('0');
          setPriceLoading(false);
          return;
        }

        setIsPairValid(true);

        // 1. Intentar cálculo canónico oficial con backend (/calculate)
        try {
          const calcResult = await swapService.calculateExchange(pair.id, fromAmount, 'sell');
          if (calcResult?.calculo) {
            const finalAmt = calcResult.calculo.finalAmount || calcResult.calculo.quoteAmount;
            setToAmount(parseFloat(finalAmt).toFixed(8));
            setFeeAmount(String(calcResult.calculo.feeAmount || '0'));
            setFeePercent(String(calcResult.calculo.feePercent || pair.feePercent || '0.1'));
            setExchangeRate(parseFloat(calcResult.calculo.precioEfectivo || pair.currentPrice));
            setPriceLoading(false);
            return;
          }
        } catch (calcErr) {
          console.warn('[useSwap] calculateExchange fallback to fast price:', calcErr?.message);
        }

        // 2. Fallback con cotización rápida si no se pudo calcular por API
        const price = await swapService.getCurrentPrice(fromCrypto.symbol, toCrypto.symbol);

        if (!price || price <= 0) {
          throw new Error('No se pudo obtener el precio');
        }

        const feeRate = parseFloat(pair.feePercent || '0.1') / 100;
        const grossAmount = parseFloat(fromAmount) * price;
        const feeEst = grossAmount * feeRate;
        const netAmount = grossAmount - feeEst;

        setToAmount(netAmount.toFixed(8));
        setFeeAmount(feeEst.toFixed(8));
        setFeePercent(String(pair.feePercent || '0.1'));
        setExchangeRate(price);
      } catch (error) {
        console.error('[useSwap] Error getting price:', error);
        
        // Intentar par inverso
        try {
          const inversePair = await swapService.getExchangePair(toCrypto.symbol, fromCrypto.symbol);
          const isInvActive = inversePair && (inversePair.active !== undefined ? inversePair.active : (inversePair.activo !== undefined ? inversePair.activo : true));
          
          if (inversePair && isInvActive) {
            setIsPairValid(true);
            const inversePrice = await swapService.getCurrentPrice(toCrypto.symbol, fromCrypto.symbol);
            
            if (inversePrice > 0) {
              const price = 1 / inversePrice;
              const feeRate = parseFloat(inversePair.feePercent || '0.1') / 100;
              const grossAmount = parseFloat(fromAmount) * price;
              const feeEst = grossAmount * feeRate;
              const netAmount = grossAmount - feeEst;

              setToAmount(netAmount.toFixed(8));
              setFeeAmount(feeEst.toFixed(8));
              setFeePercent(String(inversePair.feePercent || '0.1'));
              setExchangeRate(price);
            }
          } else {
            setIsPairValid(false);
            setToAmount('');
            setExchangeRate(null);
            setFeeAmount('0');
          }
        } catch (inverseError) {
          setIsPairValid(false);
          setToAmount('');
          setExchangeRate(null);
          setFeeAmount('0');
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
      const result = await swapService.executeSwap(pair.id, parseFloat(fromAmount), 'sell');

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
        setFeeAmount('0');

        toast.success('¡Intercambio realizado exitosamente!');
      },
      onError: (error) => {
        console.error('[useSwap] Error executing swap:', error);
        const errorMessage =
          error.response?.data?.error?.message ||
          error.response?.data?.error ||
          error.message ||
          'Error al ejecutar el intercambio';
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
    setFeeAmount('0');
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
    setFeeAmount('0');
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
    setFeeAmount('0');
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
    feeAmount,
    feePercent,
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