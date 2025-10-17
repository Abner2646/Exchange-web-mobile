import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import p2pService from '../services/p2pService';
import userService from '../services/userService';
import { invertirTipoOperacion, ordenarOfertasPorPrecio } from '../utils/p2pHelpers';

/**
 * Hook para obtener criptomonedas disponibles en P2P
 */
export const useCriptomonedas = () => {
  const { data = [], isLoading, error } = useQuery(
    'p2p-cryptos',
    () => p2pService.getCriptomonedas(),
    {
      staleTime: 300000, // 5 minutos
      cacheTime: 600000, // 10 minutos
    }
  );

  return {
    criptomonedas: data,
    isLoading,
    error,
  };
};

/**
 * Hook para obtener métodos de pago activos
 */
export const useMetodosPago = () => {
  const { data = [], isLoading, error } = useQuery(
    'p2p-metodos-pago',
    () => p2pService.getMetodosPagoActivos(),
    {
      staleTime: 300000, // 5 minutos
      cacheTime: 600000, // 10 minutos
    }
  );

  return {
    metodosPago: data,
    isLoading,
    error,
  };
};

/**
 * Hook principal para obtener y gestionar ofertas P2P
 */
export const useOfertas = (tipoOperacion, criptoSeleccionada) => {
  const tipoOfertaAPI = invertirTipoOperacion(tipoOperacion);

  const { 
    data = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery(
    ['p2p-ofertas', tipoOfertaAPI, criptoSeleccionada],
    () => p2pService.getOfertas({
      activa: true,
      tipo: tipoOfertaAPI,
      criptomonedaId: criptoSeleccionada,
    }),
    {
      enabled: !!criptoSeleccionada,
      staleTime: 30000,
      cacheTime: 60000,
    }
  );

  const ofertasOrdenadas = ordenarOfertasPorPrecio(data, tipoOperacion);

  return {
    ofertas: ofertasOrdenadas,
    isLoading,
    error,
    refetch,
  };
};

/**
 * Hook para gestionar cache de perfiles de usuario
 */
export const useUsuariosCache = () => {
  const [usuariosCache, setUsuariosCache] = useState({});

  const cargarPerfilUsuario = async (usuarioId) => {
    if (usuariosCache[usuarioId]) {
      console.log(`✅ Usuario ${usuarioId} obtenido del cache`);
      return usuariosCache[usuarioId];
    }

    const userData = await userService.getUserProfile(usuarioId);
    
    if (userData) {
      setUsuariosCache(prev => ({
        ...prev,
        [usuarioId]: userData,
      }));
    }

    return userData;
  };

  const cargarPerfilesMultiples = async (usuarioIds) => {
    const uniqueIds = [...new Set(usuarioIds)];
    const promises = uniqueIds.map(id => cargarPerfilUsuario(id));
    await Promise.all(promises);
  };

  const getUsuarioData = (usuarioId) => {
    return usuariosCache[usuarioId] || null;
  };

  return {
    usuariosCache,
    cargarPerfilUsuario,
    cargarPerfilesMultiples,
    getUsuarioData,
  };
};

/**
 * Hook para obtener mis ofertas
 */
export const useMyOfertas = () => {
  const queryClient = useQueryClient();

  const { 
    data = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery(
    'my-p2p-ofertas',
    () => p2pService.getMyOfertas(),
    {
      staleTime: 30000,
      cacheTime: 60000,
    }
  );

  const toggleMutation = useMutation(
    (ofertaId) => p2pService.toggleOferta(ofertaId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('my-p2p-ofertas');
        toast.success('Estado de oferta actualizado');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Error al cambiar estado de oferta');
      },
    }
  );

  return {
    ofertas: data,
    isLoading,
    error,
    refetch,
    toggleOferta: toggleMutation.mutate,
    isToggling: toggleMutation.isLoading,
  };
};

/**
 * Hook para obtener mis transacciones
 */
export const useMyTransacciones = () => {
  const queryClient = useQueryClient();

  const { 
    data = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery(
    'my-p2p-transacciones',
    () => p2pService.getMyTransacciones(),
    {
      staleTime: 20000,
      cacheTime: 40000,
    }
  );

  const confirmPaymentMutation = useMutation(
    (transaccionId) => p2pService.confirmPayment(transaccionId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('my-p2p-transacciones');
        toast.success('Pago confirmado exitosamente');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Error al confirmar pago');
      },
    }
  );

  const releaseCryptosMutation = useMutation(
    (transaccionId) => p2pService.releaseCryptos(transaccionId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('my-p2p-transacciones');
        toast.success('Criptomonedas liberadas exitosamente');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Error al liberar criptomonedas');
      },
    }
  );

  const cancelTransactionMutation = useMutation(
    (transaccionId) => p2pService.cancelTransaction(transaccionId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('my-p2p-transacciones');
        toast.success('Transacción cancelada');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Error al cancelar transacción');
      },
    }
  );

  return {
    transacciones: data,
    isLoading,
    error,
    refetch,
    confirmPayment: confirmPaymentMutation.mutate,
    isConfirmingPayment: confirmPaymentMutation.isLoading,
    releaseCryptos: releaseCryptosMutation.mutate,
    isReleasingCryptos: releaseCryptosMutation.isLoading,
    cancelTransaction: cancelTransactionMutation.mutate,
    isCancelling: cancelTransactionMutation.isLoading,
  };
};

/**
 * ⭐ NUEVO: Hook para crear oferta P2P
 */
export const useCreateOferta = () => {
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    (ofertaData) => p2pService.createOferta(ofertaData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('my-p2p-ofertas');
        queryClient.invalidateQueries('p2p-ofertas');
        console.log('✅ Oferta creada y queries invalidadas');
      },
      onError: (error) => {
        console.error('❌ Error en mutation:', error);
      },
    }
  );

  return {
    createOferta: createMutation.mutate,
    createOfertaAsync: createMutation.mutateAsync,
    isCreating: createMutation.isLoading,
    isSuccess: createMutation.isSuccess,
    isError: createMutation.isError,
    error: createMutation.error,
  };
};

export default {
  useCriptomonedas,
  useMetodosPago,
  useOfertas,
  useUsuariosCache,
  useMyOfertas,
  useMyTransacciones,
  useCreateOferta,
};