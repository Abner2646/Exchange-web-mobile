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
  const [currentPair, setCurrentPair] = useState(null);

  // ==================== CARGAR DATOS INICIALES ====================

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
        
        if (usdt && !fromCrypto) setFromCrypto(usdt);
        if (btc && !toCrypto) setToCrypto(btc);
      }
    } catch (err) {
      console.error('Error cargando criptomonedas:', err);
      setError('Error al cargar criptomonedas disponibles');
    }
  }, [fromCrypto, toCrypto]);

  // Cargar balances del usuario
  const loadBalances = useCallback(async () => {
    try {
      setError(null);
      const data = await swapService.getMyBalances();
      console.log('=== DEBUG BALANCES ===');
      console.log('Raw data from API:', data);
      console.log('Is array:', Array.isArray(data));
      if (Array.isArray(data) && data.length > 0) {
        console.log('First balance structure:', data[0]);
        console.log('All balance keys:', Object.keys(data[0]));
      }
      setBalances(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando balances:', err);
      setError('Error al cargar balances');
    }
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    loadCryptos();
    loadBalances();
  }, [loadCryptos, loadBalances]);

  // ==================== UTILIDADES ====================

  // Obtener balance de una criptomoneda
  const getBalance = useCallback((symbol) => {
    if (!symbol || !balances.length || !cryptos.length) return 0;
    
    console.log(`=== DEBUG getBalance para ${symbol} ===`);
    console.log('Balances disponibles:', balances);
    console.log('Cryptos disponibles:', cryptos);
    
    // Primero encontrar la crypto por symbol para obtener su ID
    const crypto = cryptos.find(c => c.symbol === symbol);
    if (!crypto) {
      console.log(`No se encontró crypto con symbol ${symbol}`);
      return 0;
    }
    
    console.log(`Crypto encontrada:`, crypto);
    
    // Buscar el balance por criptomonedaId
    const balance = balances.find(b => b.criptomonedaId === crypto.id);
    
    console.log(`Balance encontrado para ${symbol}:`, balance);
    
    if (!balance) {
      console.log(`No se encontró balance para criptomonedaId ${crypto.id}`);
      return 0;
    }
    
    // Usar la estructura correcta: balanceDisponible
    const disponible = balance.balanceDisponible || 
                      balance.disponible || 
                      balance.saldoDisponible || 
                      balance.available ||
                      balance.balance ||
                      balance.amount ||
                      0;
    
    console.log(`Saldo disponible para ${symbol}: ${disponible}`);
    
    return parseFloat(disponible) || 0;
  }, [balances, cryptos]);

  // ==================== PAR DE EXCHANGE ====================

  // Obtener o cargar par de exchange
  const getExchangePair = useCallback(async (baseSymbol, quoteSymbol) => {
    if (!baseSymbol || !quoteSymbol) return null;
    
    const pairKey = `${baseSymbol}-${quoteSymbol}`;
    
    // Si ya tenemos el par en cache, devolverlo
    if (exchangePairs[pairKey]) {
      return exchangePairs[pairKey];
    }
    
    try {
      const pair = await swapService.getExchangePair(baseSymbol, quoteSymbol);
      
      // Guardar en cache
      setExchangePairs(prev => ({
        ...prev,
        [pairKey]: pair
      }));
      
      return pair;
    } catch (err) {
      console.error('Error obteniendo par de exchange:', err);
      
      // Intentar par inverso
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

  // ==================== CÁLCULO DE INTERCAMBIO ====================

  // Obtener precio actual de un par
  const getCurrentPrice = useCallback(async (fromCrypto, toCrypto) => {
    if (!fromCrypto || !toCrypto) return null;
    
    try {
      console.log(`=== OBTENIENDO PRECIO ${fromCrypto.symbol}/${toCrypto.symbol} ===`);
      
      const priceData = await swapService.getCurrentPrice(fromCrypto.symbol, toCrypto.symbol);
      
      console.log('Respuesta precio:', priceData);
      
      // Extraer el precio de la respuesta
      const precio = priceData.precio || 
                    priceData.rate || 
                    priceData.tasa ||
                    priceData.precioActual ||
                    priceData.price || 0;
      
      console.log('Precio extraído:', precio);
      
      return precio;
      
    } catch (err) {
      console.error('Error obteniendo precio:', err);
      
      // Intentar par inverso si falla
      try {
        console.log(`Intentando par inverso: ${toCrypto.symbol}/${fromCrypto.symbol}`);
        const inversePriceData = await swapService.getCurrentPrice(toCrypto.symbol, fromCrypto.symbol);
        const inversePrice = inversePriceData.precio || inversePriceData.rate || inversePriceData.tasa || 0;
        
        // Si tenemos precio inverso, calculamos el directo
        if (inversePrice > 0) {
          const directPrice = 1 / inversePrice;
          console.log('Precio inverso calculado:', directPrice);
          return directPrice;
        }
      } catch (inverseErr) {
        console.error('Error con par inverso:', inverseErr);
      }
      
      return null;
    }
  }, []);

  // Calcular intercambio simple (solo para mostrar cantidad estimada)
  const calculateSimpleExchange = useCallback(async (amount, fromCrypto, toCrypto) => {
    if (!amount || !fromCrypto || !toCrypto || parseFloat(amount) <= 0) {
      setToAmount('');
      setExchangeRate(null);
      setExchangeData(null);
      return;
    }

    try {
      setError(null);
      
      console.log('=== CÁLCULO SIMPLE ===');
      console.log('Amount:', amount);
      console.log('From:', fromCrypto.symbol);
      console.log('To:', toCrypto.symbol);
      
      // Obtener precio actual
      const precio = await getCurrentPrice(fromCrypto, toCrypto);
      
      if (!precio || precio <= 0) {
        throw new Error(`No se pudo obtener precio para ${fromCrypto.symbol}/${toCrypto.symbol}`);
      }
      
      // Calcular cantidad destino
      const cantidadDestino = parseFloat(amount) * precio;
      
      console.log('Precio obtenido:', precio);
      console.log('Cantidad calculada:', cantidadDestino);
      
      setToAmount(cantidadDestino.toFixed(8));
      setExchangeRate(precio);
      
      // No setear exchangeData aquí, solo en vista previa
      setExchangeData(null);
      
    } catch (err) {
      console.error('Error en cálculo simple:', err);
      setError(err.message || 'Error al obtener precio');
      setToAmount('');
      setExchangeRate(null);
      setExchangeData(null);
    }
  }, [getCurrentPrice]);

  // Calcular detalles completos para vista previa
  const calculateDetailedExchange = useCallback(async (amount, fromCrypto, toCrypto) => {
    if (!amount || !fromCrypto || !toCrypto || parseFloat(amount) <= 0) {
      return null;
    }

    try {
      setError(null);
      
      console.log('=== CÁLCULO DETALLADO PARA VISTA PREVIA ===');
      
      // Obtener el par de exchange
      const pair = await getExchangePair(fromCrypto.symbol, toCrypto.symbol);
      
      if (!pair) {
        throw new Error(`Par de intercambio ${fromCrypto.symbol}/${toCrypto.symbol} no encontrado`);
      }

      console.log('Par encontrado para cálculo detallado:', pair);
      setCurrentPair(pair);
      
      // Preparar datos para el cálculo detallado
      const calculateData = {
        parId: pair.id, 
        cantidadBase: parseFloat(amount),
        tipo: 'compra'
      };
      
      console.log('Enviando a /calculate:', calculateData);
      
      // Calcular usando la API
      const calculation = await swapService.calculateExchange(
        pair.id, 
        parseFloat(amount),
        'venta'
      );
      
      console.log('Respuesta de /calculate:', calculation);
      
      // Extraer datos del cálculo
      const calculatedAmount = calculation.cantidadQuote || 
                              calculation.cantidad || 
                              calculation.cantidadFinal ||
                              calculation.resultado ||
                              calculation.amount || 0;
                              
      const rate = calculation.precio || 
                   calculation.tasa || 
                   calculation.rate ||
                   calculation.precioUnitario ||
                   (calculatedAmount / parseFloat(amount));
      
      console.log('Cantidad calculada detallada:', calculatedAmount);
      console.log('Tasa extraída detallada:', rate);
      
      // Actualizar con datos detallados
      setToAmount(calculatedAmount.toFixed(8));
      setExchangeRate(rate);
      setExchangeData(calculation);
      
      return calculation;
      
    } catch (err) {
      console.error('=== ERROR EN CÁLCULO DETALLADO ===');
      console.error('Error completo:', err);
      console.error('Mensaje:', err.message);
      setError(err.message || 'Error al calcular detalles del intercambio');
      throw err;
    }
  }, [getExchangePair]);

  // ==================== EJECUTAR SWAP ====================

  // Ejecutar el intercambio
  const executeSwap = useCallback(async () => {
    if (!fromAmount || !fromCrypto || !toCrypto) {
      throw new Error('Datos insuficientes para ejecutar el swap');
    }

    setLoading(true);
    setError(null);

    try {
      // Verificar balance localmente (ya tenemos los balances cargados)
      const availableBalance = getBalance(fromCrypto.symbol);
      const requiredAmount = parseFloat(fromAmount);
      
      console.log('=== VERIFICACIÓN DE BALANCE ===');
      console.log('Balance disponible:', availableBalance);
      console.log('Cantidad requerida:', requiredAmount);
      
      if (availableBalance < requiredAmount) {
        throw new Error(`Balance insuficiente. Disponible: ${availableBalance} ${fromCrypto.symbol}, Requerido: ${requiredAmount} ${fromCrypto.symbol}`);
      }

      // Obtener el par de exchange
      const pair = await getExchangePair(fromCrypto.symbol, toCrypto.symbol);
      
      if (!pair) {
        throw new Error(`Par de intercambio ${fromCrypto.symbol}/${toCrypto.symbol} no encontrado`);
      }

      console.log('=== EJECUTANDO SWAP ===');
      console.log('Par ID:', pair.id);
      console.log('Cantidad base:', requiredAmount);
      
      // Ejecutar el swap
      const result = await swapService.executeSwap(
        pair.id,
        requiredAmount,
        'venta'
      );

      console.log('=== SWAP EXITOSO ===');
      console.log('Resultado:', result);

      // Recargar balances después del swap exitoso
      await loadBalances();
      
      // Limpiar formulario
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

  // ==================== HANDLERS ====================

  // Cambiar criptomoneda origen
  const handleFromCryptoChange = useCallback((crypto) => {
    setFromCrypto(crypto);
    
    // Si es la misma que toCrypto, limpiar toCrypto
    if (toCrypto && crypto.id === toCrypto.id) {
      setToCrypto(null);
    }
    
    setFromAmount('');
    setToAmount('');
    setExchangeRate(null);
    setExchangeData(null);
    setCurrentPair(null);
  }, [toCrypto]);

  // Cambiar criptomoneda destino
  const handleToCryptoChange = useCallback((crypto) => {
    setToCrypto(crypto);
    
    // Si es la misma que fromCrypto, limpiar fromCrypto
    if (fromCrypto && crypto.id === fromCrypto.id) {
      setFromCrypto(null);
    }
    
    setFromAmount('');
    setToAmount('');
    setExchangeRate(null);
    setExchangeData(null);
    setCurrentPair(null);
  }, [fromCrypto]);

  // Cambiar cantidad origen
  const handleFromAmountChange = useCallback((value) => {
    setFromAmount(value);
    
    if (value && fromCrypto && toCrypto) {
      // Usar cálculo simple solo para mostrar precio estimado
      // No hacemos el cálculo detallado hasta vista previa
      const timeoutId = setTimeout(() => {
        calculateSimpleExchange(value, fromCrypto, toCrypto);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    } else {
      setToAmount('');
      setExchangeRate(null);
      setExchangeData(null);
    }
  }, [fromCrypto, toCrypto, calculateSimpleExchange]);

  // Intercambiar criptomonedas
  const handleSwapCryptos = useCallback(() => {
    const tempCrypto = fromCrypto;
    setFromCrypto(toCrypto);
    setToCrypto(tempCrypto);
    setFromAmount('');
    setToAmount('');
    setExchangeRate(null);
    setExchangeData(null);
    setCurrentPair(null);
  }, [fromCrypto, toCrypto]);

  // Usar máximo balance
  const handleUseMaxBalance = useCallback(() => {
    if (fromCrypto) {
      const maxBalance = getBalance(fromCrypto.symbol);
      setFromAmount(maxBalance.toString());
      
      if (toCrypto && maxBalance > 0) {
        calculateSimpleExchange(maxBalance.toString(), fromCrypto, toCrypto);
      }
    }
  }, [fromCrypto, toCrypto, getBalance, calculateSimpleExchange]);

  // Limpiar error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Filtrar criptomonedas disponibles para "De"
  const getAvailableFromCryptos = useCallback(() => {
    if (!toCrypto) return cryptos;
    return cryptos.filter(crypto => crypto.id !== toCrypto.id);
  }, [cryptos, toCrypto]);

  // Filtrar criptomonedas disponibles para "A"  
  const getAvailableToCryptos = useCallback(() => {
    if (!fromCrypto) return cryptos;
    return cryptos.filter(crypto => crypto.id !== fromCrypto.id);
  }, [cryptos, fromCrypto]);

  // ==================== RETORNO ====================

  return {
    // Datos
    cryptos,
    balances,
    
    // Estados del swap
    fromCrypto,
    toCrypto,
    fromAmount,
    toAmount,
    exchangeRate,
    exchangeData,
    currentPair,
    
    // Estados de la UI
    loading,
    error,
    
    // Funciones
    getBalance,
    executeSwap,
    loadBalances,
    loadCryptos,
    clearError,
    getAvailableFromCryptos,
    getAvailableToCryptos,
    calculateDetailedExchange,
    
    // Handlers
    handleFromCryptoChange,
    handleToCryptoChange,
    handleFromAmountChange,
    handleSwapCryptos,
    handleUseMaxBalance,
    
    // Validaciones
    canExecuteSwap: !!(fromAmount && fromCrypto && toCrypto && exchangeData && !loading && fromCrypto.id !== toCrypto.id),
    hasInsufficientBalance: fromAmount && fromCrypto ? parseFloat(fromAmount) > getBalance(fromCrypto.symbol) : false,
    isSameCurrency: !!(fromCrypto && toCrypto && fromCrypto.id === toCrypto.id)
  };
};

export default useSwap;