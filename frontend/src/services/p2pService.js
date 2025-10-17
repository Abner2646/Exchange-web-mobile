import apiClient from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

class P2PService {
  /**
   * Obtener todas las criptomonedas disponibles para P2P
   */
  async getCriptomonedas() {
    try {
      const response = await apiClient.get(ENDPOINTS.P2P_CRYPTOS);
      
      console.log('💰 Criptomonedas P2P obtenidas');
      
      // Normalizar respuesta
      if (Array.isArray(response.data)) return response.data;
      if (response.data?.data) return response.data.data;
      return [];
    } catch (error) {
      console.error('❌ Error obteniendo criptomonedas P2P:', error);
      return [];
    }
  }

  /**
   * Obtener métodos de pago activos
   */
  async getMetodosPagoActivos() {
    try {
      const response = await apiClient.get(ENDPOINTS.P2P_METODOS_PAGO_ACTIVOS);
      
      console.log('💳 Métodos de pago activos obtenidos');
      
      // Normalizar respuesta
      if (Array.isArray(response.data)) return response.data;
      if (response.data?.data) return response.data.data;
      return [];
    } catch (error) {
      console.error('❌ Error obteniendo métodos de pago:', error);
      return [];
    }
  }

  /**
   * Obtener ofertas P2P con filtros
   */
  async getOfertas(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.activa !== undefined) {
        queryParams.append('activa', params.activa.toString());
      }
      if (params.tipo) {
        queryParams.append('tipo', params.tipo);
      }
      if (params.criptomonedaId) {
        queryParams.append('criptomonedaId', params.criptomonedaId);
      }

      console.log('🔍 Obteniendo ofertas P2P con params:', params);

      const response = await apiClient.get(`${ENDPOINTS.P2P_OFERTAS}?${queryParams}`);
      
      let ofertas = response.data?.data || response.data;
      
      if (!Array.isArray(ofertas)) {
        ofertas = [];
      }

      console.log(`✅ ${ofertas.length} ofertas obtenidas`);
      
      return ofertas;
    } catch (error) {
      console.error('❌ Error obteniendo ofertas P2P:', error);
      throw error;
    }
  }

  /**
   * Obtener mis ofertas
   */
  async getMyOfertas() {
    try {
      const response = await apiClient.get(ENDPOINTS.P2P_MY_OFERTAS);
      
      console.log('📝 Mis ofertas obtenidas');
      
      let ofertas = response.data?.data || response.data;
      
      if (!Array.isArray(ofertas)) {
        ofertas = [];
      }

      console.log(`✅ ${ofertas.length} ofertas propias`);
      
      return ofertas;
    } catch (error) {
      console.error('❌ Error obteniendo mis ofertas:', error);
      throw error;
    }
  }

  /**
   * Obtener mis transacciones
   */
  async getMyTransacciones() {
    try {
      console.log('📋 Cargando mis transacciones...');
      
      let response;
      try {
        response = await apiClient.get(ENDPOINTS.P2P_MY_TRANSACCIONES);
      } catch (error) {
        console.log('⚠️ Endpoint principal falló, intentando alternativo...');
        response = await apiClient.get(ENDPOINTS.P2P_MY_TRANSACCIONES_PENDING);
      }
      
      let transacciones;
      if (Array.isArray(response.data)) {
        transacciones = response.data;
      } else if (response.data?.transacciones) {
        transacciones = response.data.transacciones;
      } else if (response.data?.data) {
        transacciones = response.data.data;
      } else {
        transacciones = [];
      }

      console.log(`✅ ${transacciones.length} transacciones obtenidas`);
      
      return transacciones;
    } catch (error) {
      console.error('❌ Error obteniendo mis transacciones:', error);
      throw error;
    }
  }

  /**
   * Activar/Desactivar oferta
   */
  async toggleOferta(ofertaId) {
    try {
      const response = await apiClient.patch(ENDPOINTS.P2P_OFERTA_TOGGLE(ofertaId));
      
      console.log(`🔄 Oferta ${ofertaId} toggle exitoso`);
      
      return response.data;
    } catch (error) {
      console.error(`❌ Error haciendo toggle de oferta ${ofertaId}:`, error);
      throw error;
    }
  }

  /**
   * Confirmar pago (comprador)
   */
  async confirmPayment(transaccionId) {
    try {
      const response = await apiClient.patch(
        ENDPOINTS.P2P_TRANSACCION_CONFIRM_PAYMENT(transaccionId)
      );
      
      console.log(`💰 Pago confirmado para transacción ${transaccionId}`);
      
      return response.data;
    } catch (error) {
      console.error(`❌ Error confirmando pago de transacción ${transaccionId}:`, error);
      throw error;
    }
  }

  /**
   * Liberar criptomonedas (vendedor)
   */
  async releaseCryptos(transaccionId) {
    try {
      const response = await apiClient.patch(
        ENDPOINTS.P2P_TRANSACCION_COMPLETE(transaccionId)
      );
      
      console.log(`🚀 Criptomonedas liberadas para transacción ${transaccionId}`);
      
      return response.data;
    } catch (error) {
      console.error(`❌ Error liberando criptos de transacción ${transaccionId}:`, error);
      throw error;
    }
  }

  /**
   * Cancelar transacción
   */
  async cancelTransaction(transaccionId) {
    try {
      const response = await apiClient.patch(
        ENDPOINTS.P2P_TRANSACCION_CANCEL(transaccionId)
      );
      
      console.log(`❌ Transacción ${transaccionId} cancelada`);
      
      return response.data;
    } catch (error) {
      console.error(`❌ Error cancelando transacción ${transaccionId}:`, error);
      throw error;
    }
  }

  /**
   * ⭐ NUEVO: Crear oferta P2P
   */
  async createOferta(ofertaData) {
    try {
      console.log('📝 Creando oferta P2P:', ofertaData);
      
      const response = await apiClient.post(ENDPOINTS.P2P_CREATE_OFERTA, {
        tipo: ofertaData.tipo,
        criptomonedaId: ofertaData.criptomonedaId,
        cantidadMin: parseFloat(ofertaData.cantidadMin),
        cantidadMax: parseFloat(ofertaData.cantidadMax),
        precioUnitario: parseFloat(ofertaData.precioUnitario),
        monedaFiat: ofertaData.monedaFiat,
        direccionFiat: ofertaData.direccionFiat || null,
        condicionesAdicionales: ofertaData.condicionesAdicionales || null,
        metodosPagoIds: ofertaData.metodosPagoIds,
      });
      
      console.log('✅ Oferta creada exitosamente:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ Error creando oferta P2P:', error);
      throw error;
    }
  }
}

export default new P2PService();