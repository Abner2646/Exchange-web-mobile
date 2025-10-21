// src/services/transferService.js
import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

class TransferService {
  // Verificar fondos suficientes
  async verifyFunds(cryptoId, amount) {
    const response = await apiClient.post(ENDPOINTS.TRANSFER_VERIFY_FUNDS, {
      criptomonedaId: cryptoId,
      cantidad: amount,
    });
    return response.data.tieneFondos;
  }

  // Crear transferencia
  async createTransfer({ destinatarioId, cryptoId, cantidad, nota }) {
    const response = await apiClient.post(ENDPOINTS.TRANSFERS, {
      usuarioDestinatarioId: destinatarioId,
      criptomonedaId: cryptoId,
      cantidad: parseFloat(cantidad),
      concepto: 'Transferencia',
      nota: nota || undefined,
    });
    return response.data;
  }

  // Procesar transferencia con código
  async processTransfer(transferId, codigo) {
    const response = await apiClient.post(
      ENDPOINTS.TRANSFER_PROCESS(transferId),
      { codigoVerificacion: codigo }
    );
    return response.data;
  }

  // Reenviar código de verificación
  async resendCode(transferId) {
    const response = await apiClient.post(ENDPOINTS.TRANSFER_RESEND_CODE(transferId));
    return response.data;
  }

  // Obtener historial de transferencias
  async getMyTransfers() {
    try {
      const response = await apiClient.get(ENDPOINTS.MY_TRANSFERS);
      console.log('📥 TransferService: Response completo:', response);

      // Normalizar respuesta
      let transfers = [];
      if (response.data?.transferencias) {
        transfers = response.data.transferencias;
      } else if (Array.isArray(response.data)) {
        transfers = response.data;
      } else if (response.data?.data) {
        transfers = response.data.data;
      }

      console.log('✅ TransferService: Transferencias normalizadas:', transfers.length);
      return transfers;
    } catch (error) {
      console.error('❌ TransferService: Error obteniendo transferencias:', error);
      throw error;
    }
  }

  /**
   * Identificar tipo de transferencia
   * @param {Object} transfer - Transferencia
   * @param {String} currentUserId - ID del usuario actual
   * @returns {String} 'sent' | 'received'
   */
  getTransferType(transfer, currentUserId) {
    if (!transfer || !currentUserId) {
      console.warn('⚠️ Transfer o currentUserId faltante');
      return 'sent';
    }

    // Normalizar IDs a string para comparación segura
    const normalize = (id) => String(id || '').trim().toLowerCase();

    const currentId = normalize(currentUserId);
    const destId = normalize(transfer.destinatario?.id || transfer.usuarioDestinatarioId);
    const remId = normalize(transfer.remitente?.id || transfer.usuarioRemitenteId);

    console.log('🔍 getTransferType:', {
      transferId: transfer.id,
      currentId,
      destId,
      remId,
      isReceived: destId === currentId,
      isSent: remId === currentId,
    });

    // Si soy el destinatario → RECIBIDA
    if (destId && destId === currentId) {
      console.log('✅ RECIBIDA');
      return 'received';
    }

    // Si soy el remitente → ENVIADA
    if (remId && remId === currentId) {
      console.log('✅ ENVIADA');
      return 'sent';
    }

  console.warn('⚠️ No match para transfer:', transfer.id);
  return 'sent';
}

  /**
   * ⭐ MEJORADO: Filtrar historial
   * - Oculta automáticamente transferencias pendientes
   * - Filtra por tipo (enviada/recibida/todas)
   * - Filtra por búsqueda, crypto y fecha
   */
  filterTransfers(transfers, filters, currentUserId) {
    let filtered = [...transfers];

    // ⭐ FILTRO AUTOMÁTICO: Ocultar pendientes
    filtered = filtered.filter((t) => t.estado !== 'pendiente');
    console.log('🔍 Después de filtrar pendientes:', filtered.length);

    // ⭐ FILTRO POR TIPO (enviada/recibida/todas)
    if (filters.type && filters.type !== 'all') {
      filtered = filtered.filter((t) => {
        const type = this.getTransferType(t, currentUserId);
        return type === filters.type;
      });
      console.log(`🔍 Después de filtrar tipo "${filters.type}":`, filtered.length);
    }

    // Filtro por búsqueda
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

    // Filtro por crypto
    if (filters.crypto && filters.crypto !== 'all') {
      filtered = filtered.filter(
        (t) => t.criptomonedaTransferencia?.symbol === filters.crypto
      );
    }

    // Filtro por rango de fecha
    if (filters.dateRange && filters.dateRange !== 'all') {
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

    return filtered;
  }
}

export default new TransferService();