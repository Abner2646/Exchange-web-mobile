import { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import depositService from '../services/depositService';

export const useDeposits = () => {
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [showMoreInfo, setShowMoreInfo] = useState(false);

  /**
   * Query para obtener dirección de depósito
   * Solo se ejecuta cuando hay una crypto seleccionada
   */
  const {
    data: depositAddress = null,
    isLoading: loadingAddress,
    refetch: refetchAddress,
  } = useQuery(
    ['deposit-address', selectedCrypto?.id],
    () => depositService.getDepositAddressByCrypto(selectedCrypto.id),
    {
      enabled: !!selectedCrypto?.id, // Solo ejecutar si hay crypto seleccionada
      staleTime: 60000, // 1 minuto
      cacheTime: 300000, // 5 minutos
      retry: 1,
    }
  );

  /**
   * Auto-cargar dirección cuando cambia la crypto seleccionada
   */
  useEffect(() => {
    if (selectedCrypto) {
      console.log('=== useDeposits: Crypto seleccionada cambió ===');
      console.log('Nueva crypto:', selectedCrypto);
      refetchAddress();
    }
  }, [selectedCrypto, refetchAddress]);

  /**
   * Manejar cambio de criptomoneda
   */
  const handleCryptoChange = (crypto) => {
    console.log('=== useDeposits: handleCryptoChange ===');
    console.log('Cambiando a crypto:', crypto);
    
    setSelectedCrypto(crypto);
    setSelectedNetwork(crypto.red);
  };

  /**
   * Toggle de "más información"
   */
  const toggleMoreInfo = () => {
    setShowMoreInfo(prev => !prev);
  };

  return {
    // Estados
    selectedCrypto,
    selectedNetwork,
    depositAddress,
    loadingAddress,
    showMoreInfo,

    // Acciones
    setSelectedCrypto,
    handleCryptoChange,
    toggleMoreInfo,
  };
};