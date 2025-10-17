import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import withdrawalService from '../services/withdrawalService';
import balanceService from '../services/balanceService';
import { useCryptos } from './useCrypto';
import {
  validateWithdrawalAddress,
  validateWithdrawalForm,
} from '../utils/validators';

export const useWithdrawals = () => {
  const queryClient = useQueryClient();

  // Estados del formulario
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [withdrawalType, setWithdrawalType] = useState('address');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [addressError, setAddressError] = useState('');

  // Obtener criptomonedas activas (reutilizando hook existente)
  const { cryptos: criptomonedas, isLoading: loadingCryptos } = useCryptos();

  // Obtener balances del usuario
  const {
    data: balances = [],
    isLoading: loadingBalances,
    refetch: refetchBalances,
  } = useQuery(
    'myBalances',
    () => balanceService.getMyBalances(),
    {
      staleTime: 30000, // 30 segundos
      onError: (error) => {
        console.error('Error al cargar balances:', error);
        toast.error('Error al cargar datos. Por favor, recarga la pagina.');
      },
    }
  );

  // Calcular balance de la criptomoneda seleccionada
  const getSelectedBalance = () => {
    if (!selectedCrypto) {
      return { disponible: 0, bloqueado: 0, total: 0 };
    }

    const balance = balances.find(
      (b) => b.criptomonedaId === selectedCrypto.id
    );

    if (!balance) {
      console.log('No se encontro balance para:', selectedCrypto.id);
      console.log('Balances disponibles:', balances);
      return { disponible: 0, bloqueado: 0, total: 0 };
    }

    const disponible = parseFloat(balance.balanceDisponible) || 0;
    const bloqueado = parseFloat(balance.balanceBloqueado) || 0;

    return {
      disponible: disponible,
      bloqueado: bloqueado,
      total: disponible + bloqueado,
    };
  };

  // Mutation para crear retiro
  const withdrawalMutation = useMutation(
    (data) => withdrawalService.createWithdrawal(data),
    {
      onSuccess: () => {
        toast.success('Retiro creado exitosamente. Sera procesado en breve.');
        
        // Limpiar formulario
        setDestinationAddress('');
        setAmount('');
        setAddressError('');

        // Refrescar balances después de 2 segundos
        setTimeout(() => {
          queryClient.invalidateQueries('myBalances');
          refetchBalances();
        }, 2000);
      },
      onError: (error) => {
        console.error('Error en retiro:', error);
        const errorMessage = error.response?.data?.message || 'Error al procesar el retiro';
        toast.error(errorMessage);
      },
    }
  );

  // Validar dirección en tiempo real
  const handleAddressValidation = (address) => {
    const validation = validateWithdrawalAddress(
      address,
      selectedCrypto?.red
    );
    
    if (!validation.isValid) {
      setAddressError(validation.error);
      return false;
    }

    setAddressError('');
    return true;
  };

  // Manejar cambio de cantidad
  const handleAmountChange = (value) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  // Establecer cantidad máxima
  const setMaxAmount = () => {
    const balance = getSelectedBalance();
    setAmount(balance.disponible.toString());
  };

  // Manejar cambio de criptomoneda
  const handleCryptoChange = (cryptoId) => {
    const crypto = criptomonedas.find((c) => c.id === cryptoId);
    setSelectedCrypto(crypto);
    setDestinationAddress('');
    setAmount('');
    setAddressError('');
  };

  // Manejar envío de retiro
  const handleWithdraw = () => {
    const balance = getSelectedBalance();

    // Validar formulario completo
    const validation = validateWithdrawalForm({
      selectedCrypto,
      destinationAddress,
      amount,
      balance: balance.disponible,
    });

    if (!validation.isValid) {
      // Mostrar el primer error encontrado
      const firstError = Object.values(validation.errors)[0];
      toast.error(firstError);
      return;
    }

    // Ejecutar mutation
    withdrawalMutation.mutate({
      criptomonedaId: selectedCrypto.id,
      cantidad: parseFloat(amount),
      direccionDestino: destinationAddress,
    });
  };

  const balance = getSelectedBalance();
  const isLoadingData = loadingCryptos || loadingBalances;

  return {
    // Datos
    criptomonedas,
    balances,
    selectedCrypto,
    balance,
    
    // Estados del formulario
    withdrawalType,
    destinationAddress,
    amount,
    addressError,
    
    // Estados de carga
    isLoadingData,
    isProcessing: withdrawalMutation.isLoading,
    
    // Acciones
    setWithdrawalType,
    setDestinationAddress,
    setAmount,
    handleCryptoChange,
    handleAmountChange,
    setMaxAmount,
    handleAddressValidation,
    handleWithdraw,
  };
};