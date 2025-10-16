// src/hooks/useTransfers.js
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import transferService from '../services/transferService';

export const useTransfers = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    search: '',
    crypto: 'all',
    dateRange: 'all',
  });

  // Obtener historial
  const { 
    data: transfers = [], 
    isLoading 
  } = useQuery(
    'transfers',
    () => transferService.getMyTransfers(),
    {
      staleTime: 60000, // 1 minuto
    }
  );

  // Crear transferencia
  const createTransfer = useMutation(
    (data) => transferService.createTransfer(data),
    {
      onSuccess: () => {
        toast.success('Código enviado a tu email');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Error al crear transferencia');
      },
    }
  );

  // Procesar transferencia
  const processTransfer = useMutation(
    ({ transferId, codigo }) => transferService.processTransfer(transferId, codigo),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('transfers');
        queryClient.invalidateQueries('balances');
        toast.success('¡Transferencia completada!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Código incorrecto');
      },
    }
  );

  // Reenviar código
  const resendCode = useMutation(
    (transferId) => transferService.resendCode(transferId),
    {
      onSuccess: () => {
        toast.success('Código reenviado');
      },
      onError: () => {
        toast.error('Error al reenviar código');
      },
    }
  );

  // Filtros
  const filteredTransfers = transferService.filterTransfers(transfers, filters);

  return {
    transfers: filteredTransfers,
    allTransfers: transfers,
    isLoading,
    createTransfer,
    processTransfer,
    resendCode,
    filters,
    setFilters,
  };
};