// hooks/useSwap.js

import { useState, useEffect, useCallback } from 'react';
import swapService from '../services/swapService';

export const useSwap = () => {
  // Estados principales
  const [cryptos, setCryptos] = useState([]);
  const [balances, setBalances] = useState([]);
  const [exchangePairs, setExchangePairs] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estados del swap
  const [fromCrypto, setFromCrypto] = useState(null);
  const [toCrypto, setToCrypto] = useState(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [exchangeRate, setExchangeRate] = useState(null);
  const [exchangeData, setExchangeData] = useState(null);
  const [isPairValid, setIsPairValid] = useState(true);

  // Cargar criptomonedas activas
  const loadCryptos = useCallback(async () => {
    try {
      setError(null);
      const data = await swapService.getActiveCryptos();
      setCryptos(Array.isArray(data) ? data : []);
      
      // Pre-seleccionar USDT y BTC si existen
      if (data.length > 0) {
        const usdt = data.find(c => c.symbol === 'USDT');
        const btc = data.find(c => c.symbol === 'BTC');
        
        if (usdt) setFromCrypto(usdt);
        if (btc) setToCrypto(btc);
      }
    } catch (err) {
      console.error('Error cargando criptomonedas:', err);
      setError('Error al cargar criptomonedas disponibles');
    }
  }, []);

  // Cargar balances del usuario
  const loadBalances = useCallback(async () => {
    try {
      setError(null);
      const data = await swapService.getMyBalances();
      setBalances(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando balances:', err);
      setError('Error al cargar balances');
    }
  }, []);

  // Obtener balance de una criptomoneda
  const getBalance = useCallback((symbol) => {
    if (!symbol || !balances.length || !cryptos.length) return 0;
    
    const crypto = cryptos.find(c => c.symbol === symbol);
    if (!crypto) return 0;
    
    const balance = balances.find(b => b.criptomonedaId === crypto.id);
    if (!balance) return 0;
    
    const disponible = balance.balanceDisponible || 
                      balance.disponible || 
                      balance.saldoDisponible || 0;
    
    return parseFloat(disponible) || 0;
  }, [balances, cryptos]);

  // Limpiar error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Filtrar criptomonedas disponibles
  const getAvailableFromCryptos = useCallback(() => {
    if (!toCrypto) return cryptos;
    return cryptos.filter(crypto => crypto.id !== toCrypto.id);
  }, [cryptos, toCrypto]);

  const getAvailableToCryptos = useCallback(() => {
    if (!fromCrypto) return cryptos;
    return cryptos.filter(crypto => crypto.id !== fromCrypto.id);
  }, [cryptos, fromCrypto]);

  // Verificar si el par existe (NO async en useCallback)
  const checkPairExists = useCallback((fromSymbol, toSymbol) => {
    if (!fromSymbol || !toSymbol) {
      setIsPairValid(false);
      return;
    }
    
    console.log(`🔍 Verificando par: ${fromSymbol}/${toSymbol}`);
    
    // Hacer la verificación de forma asíncrona
    swapService.getExchangePair(fromSymbol, toSymbol)
      .then(pair => {
        console.log('✅ Par directo encontrado:', pair);
        
        if (pair && pair.activo) {
          setIsPairValid(true);
        } else if (pair && !pair.activo) {
          console.log('⚠️ Par existe pero está inactivo');
          setIsPairValid(false);
        }
      })
      .catch(err => {
        console.log(`❌ Par directo no encontrado (${fromSymbol}/${toSymbol}):`, err.message);
        
        // Intentar par inverso
        swapService.getExchangePair(toSymbol, fromSymbol)
          .then(inversePair => {
            console.log('✅ Par inverso encontrado:', inversePair);
            
            if (inversePair && inversePair.activo) {
              setIsPairValid(true);
            } else {
              setIsPairValid(false);
            }
          })
          .catch(inverseErr => {
            console.log(`❌ Par inverso tampoco existe (${toSymbol}/${fromSymbol}):`, inverseErr.message);
            setIsPairValid(false);
          });
      });
  }, []);

  // Obtener par de exchange
  const getExchangePair = useCallback(async (baseSymbol, quoteSymbol) => {
    if (!baseSymbol || !quoteSymbol) return null;
    
    const pairKey = `${baseSymbol}-${quoteSymbol}`;
    
    if (exchangePairs[pairKey]) {
      return exchangePairs[pairKey];
    }
    
    try {
      const pair = await swapService.getExchangePair(baseSymbol, quoteSymbol);
      
      setExchangePairs(prev => ({
        ...prev,
        [pairKey]: pair
      }));
      
      return pair;
    } catch (err) {
      console.error('Error obteniendo par de exchange:', err);
      
      try {
        const inversePair = await swapService.getExchangePair(quoteSymbol, baseSymbol);
        const pairKeyInverse = `${quoteSymbol}-${baseSymbol}`;
        
        setExchangePairs(prev => ({
          ...prev,
          [pairKeyInverse]: inversePair
        }));
        
        return inversePair;
      } catch (inverseErr) {
        console.error('Error obteniendo par inverso:', inverseErr);
        return null;
      }
    }
  }, [exchangePairs]);

  // Obtener precio actual
  const getCurrentPrice = useCallback(async (fromCrypto, toCrypto) => {
    if (!fromCrypto || !toCrypto) return null;
    
    try {
      const priceData = await swapService.getCurrentPrice(fromCrypto.symbol, toCrypto.symbol);
      
      const precio = priceData.precio || 
                    priceData.rate || 
                    priceData.tasa ||
                    priceData.precioActual ||
                    priceData.price || 0;
      
      return precio;
      
    } catch (err) {
      console.error('Error obteniendo precio:', err);
      
      try {
        const inversePriceData = await swapService.getCurrentPrice(toCrypto.symbol, fromCrypto.symbol);
        const inversePrice = inversePriceData.precio || inversePriceData.rate || inversePriceData.tasa || 0;
        
        if (inversePrice > 0) {
          return 1 / inversePrice;
        }
      } catch (inverseErr) {
        console.error('Error con par inverso:', inverseErr);
      }
      
      return null;
    }
  }, []);

  // Calcular intercambio simple
  const calculateSimpleExchange = useCallback(async (amount, fromCrypto, toCrypto) => {
    if (!amount || !fromCrypto || !toCrypto || parseFloat(amount) <= 0) {
      setToAmount('');
      setExchangeRate(null);
      setExchangeData(null);
      return;
    }

    try {
      setError(null);
      
      const precio = await getCurrentPrice(fromCrypto, toCrypto);
      
      if (!precio || precio <= 0) {
        throw new Error(`No se pudo obtener precio para ${fromCrypto.symbol}/${toCrypto.symbol}`);
      }
      
      const cantidadDestino = parseFloat(amount) * precio;
      
      setToAmount(cantidadDestino.toFixed(8));
      setExchangeRate(precio);
      setExchangeData(null);
      
    } catch (err) {
      console.error('Error en cálculo simple:', err);
      setError(err.message || 'Error al obtener precio');
      setToAmount('');
      setExchangeRate(null);
      setExchangeData(null);
    }
  }, [getCurrentPrice]);

  // Ejecutar swap
  const executeSwap = useCallback(async () => {
    if (!fromAmount || !fromCrypto || !toCrypto) {
      throw new Error('Datos insuficientes para ejecutar el swap');
    }

    setLoading(true);
    setError(null);

    try {
      const availableBalance = getBalance(fromCrypto.symbol);
      const requiredAmount = parseFloat(fromAmount);
      
      if (availableBalance < requiredAmount) {
        throw new Error(`Balance insuficiente. Disponible: ${availableBalance} ${fromCrypto.symbol}`);
      }

      const pair = await getExchangePair(fromCrypto.symbol, toCrypto.symbol);
      
      if (!pair) {
        throw new Error(`Par de intercambio ${fromCrypto.symbol}/${toCrypto.symbol} no encontrado`);
      }

      const result = await swapService.executeSwap(
        pair.id,
        requiredAmount,
        'venta'
      );

      await loadBalances();
      
      setFromAmount('');
      setToAmount('');
      setExchangeRate(null);
      setExchangeData(null);

      return result;

    } catch (err) {
      console.error('Error ejecutando swap:', err);
      setError(err.message || 'Error al ejecutar el intercambio');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fromAmount, fromCrypto, toCrypto, getBalance, getExchangePair, loadBalances]);

  // Handlers
  const handleFromCryptoChange = useCallback((crypto) => {
    setFromCrypto(crypto);
    
    if (toCrypto && crypto.id === toCrypto.id) {
      setToCrypto(null);
    }
    
    setFromAmount('');
    setToAmount('');
    setExchangeRate(null);
    setExchangeData(null);
    
    // Validar par cuando cambia
    if (toCrypto && crypto.id !== toCrypto.id) {
      checkPairExists(crypto.symbol, toCrypto.symbol);
    } else {
      setIsPairValid(true);
    }
  }, [toCrypto, checkPairExists]);

  const handleToCryptoChange = useCallback((crypto) => {
    setToCrypto(crypto);
    
    if (fromCrypto && crypto.id === fromCrypto.id) {
      setFromCrypto(null);
    }
    
    setFromAmount('');
    setToAmount('');
    setExchangeRate(null);
    setExchangeData(null);
    
    // Validar par cuando cambia
    if (fromCrypto && crypto.id !== fromCrypto.id) {
      checkPairExists(fromCrypto.symbol, crypto.symbol);
    } else {
      setIsPairValid(true);
    }
  }, [fromCrypto, checkPairExists]);

  const handleFromAmountChange = useCallback((value) => {
    setFromAmount(value);
    
    if (!isPairValid) {
      setToAmount('');
      setExchangeRate(null);
      setExchangeData(null);
      return;
    }
    
    if (value && fromCrypto && toCrypto) {
      const timeoutId = setTimeout(() => {
        calculateSimpleExchange(value, fromCrypto, toCrypto);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    } else {
      setToAmount('');
      setExchangeRate(null);
      setExchangeData(null);
    }
  }, [fromCrypto, toCrypto, isPairValid, calculateSimpleExchange]);

  const handleSwapCryptos = useCallback(() => {
    const tempCrypto = fromCrypto;
    setFromCrypto(toCrypto);
    setToCrypto(tempCrypto);
    setFromAmount('');
    setToAmount('');
    setExchangeRate(null);
    setExchangeData(null);
    
    // Validar el nuevo par
    if (toCrypto && tempCrypto && toCrypto.id !== tempCrypto.id) {
      checkPairExists(toCrypto.symbol, tempCrypto.symbol);
    }
  }, [fromCrypto, toCrypto, checkPairExists]);

  const handleUseMaxBalance = useCallback(() => {
    if (fromCrypto) {
      const maxBalance = getBalance(fromCrypto.symbol);
      setFromAmount(maxBalance.toString());
      
      if (toCrypto && maxBalance > 0) {
        calculateSimpleExchange(maxBalance.toString(), fromCrypto, toCrypto);
      }
    }
  }, [fromCrypto, toCrypto, getBalance, calculateSimpleExchange]);

  // Effects
  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      console.log('❌ No hay token, redirigiendo al login...');
      window.location.href = '/login';
      return;
    }
    
    loadCryptos();
    loadBalances();
  }, [loadCryptos, loadBalances]);

  // Retorno
  return {
    cryptos,
    balances,
    fromCrypto,
    toCrypto,
    fromAmount,
    toAmount,
    exchangeRate,
    exchangeData,
    loading,
    error,
    getBalance,
    executeSwap,
    loadBalances,
    loadCryptos,
    clearError,
    getAvailableFromCryptos,
    getAvailableToCryptos,
    checkPairExists,
    handleFromCryptoChange,
    handleToCryptoChange,
    handleFromAmountChange,
    handleSwapCryptos,
    handleUseMaxBalance,
    hasInsufficientBalance: fromAmount && fromCrypto ? parseFloat(fromAmount) > getBalance(fromCrypto.symbol) : false,
    isSameCurrency: !!(fromCrypto && toCrypto && fromCrypto.id === toCrypto.id),
    isPairValid
  };
};

export default useSwap;