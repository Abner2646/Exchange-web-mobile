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
      concepto: `Transferencia`,
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
    const response = await apiClient.get(ENDPOINTS.MY_TRANSFERS);
    
    // Normalizar respuesta
    if (Array.isArray(response.data)) return response.data;
    if (response.data?.transferencias) return response.data.transferencias;
    if (response.data?.data) return response.data.data;
    return [];
  }

  // Filtrar historial
  filterTransfers(transfers, { search, crypto, dateRange }) {
    let filtered = [...transfers];

    if (search) {
      filtered = filtered.filter(t =>
        t.destinatario?.username?.toLowerCase().includes(search.toLowerCase()) ||
        t.criptomonedaTransferencia?.symbol?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (crypto && crypto !== 'all') {
      filtered = filtered.filter(t => t.criptomonedaTransferencia?.symbol === crypto);
    }

    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      const ranges = {
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
      };

      const rangeMs = ranges[dateRange];
      if (rangeMs) {
        filtered = filtered.filter(t => {
          const transferDate = new Date(t.created_at);
          return now - transferDate <= rangeMs;
        });
      }
    }

    return filtered;
  }
}

export default new TransferService();