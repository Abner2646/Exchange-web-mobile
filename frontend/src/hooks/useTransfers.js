// src/hooks/useTransfers.js
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import transferService from '../services/transferService';

export const useTransfers = (currentUserId) => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    search: '',
    crypto: 'all',
    dateRange: 'all',
    type: 'all',
  });

  // ⭐ DEBUG: Ver qué llega como currentUserId
  console.log('🔍 useTransfers recibió currentUserId:', currentUserId);

  // Obtener historial
  const { data: allTransfers = [], isLoading } = useQuery(
    'transfers',
    () => transferService.getMyTransfers(),
    {
      staleTime: 60000,
      onSuccess: (data) => {
        console.log('✅ useTransfers: Transferencias cargadas:', data.length);
      },
      onError: (error) => {
        console.error('❌ useTransfers: Error cargando transferencias:', error);
        toast.error('Error al cargar el historial');
      },
    }
  );

  // Verificar fondos
  const verifyFundsMutation = useMutation(
    ({ cryptoId, amount }) => transferService.verifyFunds(cryptoId, amount),
    {
      onError: (error) => {
        console.error('❌ Error verificando fondos:', error);
      },
    }
  );

  // Crear transferencia
  const createTransfer = useMutation((data) => transferService.createTransfer(data), {
    onSuccess: () => {
      toast.success('Código enviado a tu email');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Error al crear transferencia');
    },
  });

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
  const resendCode = useMutation((transferId) => transferService.resendCode(transferId), {
    onSuccess: () => {
      toast.success('Código reenviado');
    },
    onError: () => {
      toast.error('Error al reenviar código');
    },
  });

  // ⭐ FILTRADO MANUAL (más seguro que llamar al service)
  let filtered = [...allTransfers];

  // 1. Ocultar pendientes SIEMPRE
  filtered = filtered.filter((t) => t.estado !== 'pendiente');

  // 2. Filtro por tipo (solo si currentUserId existe)
  if (currentUserId && filters.type !== 'all') {
    filtered = filtered.filter((t) => {
      const type = transferService.getTransferType(t, currentUserId);
      return type === filters.type;
    });
  }

  // 3. Filtro por búsqueda
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    filtered = filtered.filter((t) => {
      const destinatario = t.destinatario?.username?.toLowerCase() || '';
      const remitente = t.remitente?.username?.toLowerCase() || '';
      const crypto = t.criptomonedaTransferencia?.symbol?.toLowerCase() || '';
      return (
        destinatario.includes(searchLower) ||
        remitente.includes(searchLower) ||
        crypto.includes(searchLower)
      );
    });
  }

  // 4. Filtro por crypto
  if (filters.crypto !== 'all') {
    filtered = filtered.filter((t) => t.criptomonedaTransferencia?.symbol === filters.crypto);
  }

  // 5. Filtro por fecha
  if (filters.dateRange !== 'all') {
    const now = new Date();
    const ranges = {
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };

    const rangeMs = ranges[filters.dateRange];
    if (rangeMs) {
      filtered = filtered.filter((t) => {
        const transferDate = new Date(t.created_at);
        return now - transferDate <= rangeMs;
      });
    }
  }

  // ⭐ CALCULAR CONTADORES (solo si currentUserId existe)
  let sentCount = 0;
  let receivedCount = 0;
  const allFiltered = allTransfers.filter((t) => t.estado !== 'pendiente');

  if (currentUserId) {
    sentCount = allFiltered.filter((t) => {
      const type = transferService.getTransferType(t, currentUserId);
      return type === 'sent';
    }).length;

    receivedCount = allFiltered.filter((t) => {
      const type = transferService.getTransferType(t, currentUserId);
      return type === 'received';
    }).length;
  }

  console.log('🔍 useTransfers counts:', {
    all: allFiltered.length,
    sent: sentCount,
    received: receivedCount,
  });

  return {
    transfers: filtered,
    allTransfers,
    isLoading,
    verifyFunds: verifyFundsMutation.mutateAsync,
    isVerifying: verifyFundsMutation.isLoading,
    createTransfer,
    processTransfer,
    resendCode,
    filters,
    setFilters,
    counts: {
      all: allFiltered.length,
      sent: sentCount,
      received: receivedCount,
    },
  };
};

export default useTransfers;