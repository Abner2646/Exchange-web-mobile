// scripts/testExchange.js
// Script para probar el exchange adaptado a tu arquitectura

const axios = require('axios');

const BASE_URL = 'http://localhost:3000'; // Cambia por tu URL
const API_URL = `${BASE_URL}/api/intercambios`;

// Token de autenticación (obtener del login)
let authToken = 'Bearer YOUR_JWT_TOKEN_HERE';

// Configurar axios con headers por defecto
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': authToken
  }
});

// IDs de ejemplo (reemplazar con IDs reales de tu base de datos)
const TEST_DATA = {
  pairId: '123e4567-e89b-12d3-a456-426614174000', // Par de tu SwapPair
  usuarioId: '123e4567-e89b-12d3-a456-426614174001',
  intercambioId: '123e4567-e89b-12d3-a456-426614174002'
};

class ExchangeTester {
  constructor() {
    this.results = [];
  }

  async test(name, testFunction) {
    console.log(`.🧪 Probando: ${name}`);
    try {
      const result = await testFunction();
      console.log(`✅ ${name} - OK`);
      this.results.push({ name, status: 'success', result });
      return result;
    } catch (error) {
      console.log(`❌ ${name} - ERROR: ${error.response?.data?.message || error.message}`);
      this.results.push({ 
        name, 
        status: 'error', 
        error: error.response?.data || error.message 
      });
      return null;
    }
  }

  // ================================
  // PRUEBAS DE ENDPOINTS PÚBLICOS
  // ================================

  async testPublicEndpoints() {
    console.log('.📊 PROBANDO ENDPOINTS PÚBLICOS');

    await this.test('Obtener historial de precios', async () => {
      const response = await axios.get(`${API_URL}/pairs/${TEST_DATA.pairId}/price-history?limit=10`);
      return response.data;
    });

    await this.test('Obtener último price', async () => {
      const response = await axios.get(`${API_URL}/pairs/${TEST_DATA.pairId}/last-price`);
      return response.data;
    });

    await this.test('Obtener volumen por par', async () => {
      const response = await axios.get(`${API_URL}/pairs/${TEST_DATA.pairId}/volume`);
      return response.data;
    });
  }

  // ================================
  // PRUEBAS DE OPERACIONES PRINCIPALES
  // ================================

  async testMainOperations() {
    console.log('.💱 PROBANDO OPERACIONES PRINCIPALES');

    // Calcular intercambio antes de ejecutar
    await this.test('Calcular intercambio de buy', async () => {
      const response = await api.post('/calculate', {
        pairId: TEST_DATA.pairId,
        baseAmount: 0.001,
        type: 'buy'
      });
      return response.data;
    });

    await this.test('Calcular intercambio de sell', async () => {
      const response = await api.post('/calculate', {
        pairId: TEST_DATA.pairId,
        baseAmount: 0.001,
        type: 'sell'
      });
      return response.data;
    });

    // Verificar límites
    await this.test('Verificar límite de transacción', async () => {
      const response = await api.post('/check-limit', {
        quoteAmount: 100.00
      });
      return response.data;
    });

    // Obtener balances del usuario
    await this.test('Obtener mis balances', async () => {
      const response = await api.get('/me/balances');
      return response.data;
    });

    // Ejecutar intercambio real (solo si hay balances suficientes)
    await this.test('Ejecutar intercambio de buy', async () => {
      const response = await api.post('/', {
        pairId: TEST_DATA.pairId,
        type: 'buy',
        baseAmount: 0.0001, // Cantidad muy pequeña para testing
        price: 45000.00
      });
      return response.data;
    });

    await this.test('Ejecutar intercambio de sell', async () => {
      const response = await api.post('/', {
        pairId: TEST_DATA.pairId,
        type: 'sell',
        baseAmount: 0.0001, // Cantidad muy pequeña para testing
        price: 44000.00
      });
      return response.data;
    });
  }

  // ================================
  // PRUEBAS DE CONSULTAS DE USUARIO
  // ================================

  async testUserQueries() {
    console.log('.👤 PROBANDO CONSULTAS DE USUARIO');

    await this.test('Obtener mis intercambios', async () => {
      const response = await api.get('/me?limit=10');
      return response.data;
    });

    await this.test('Obtener volumen diario', async () => {
      const response = await api.get('/me/daily-volume');
      return response.data;
    });

    await this.test('Obtener resumen de trading', async () => {
      const response = await api.get('/me/summary?period=day');
      return response.data;
    });

    await this.test('Filtrar mis intercambios por type', async () => {
      const response = await api.get('/me?type=buy&limit=5');
      return response.data;
    });

    await this.test('Filtrar mis intercambios por fecha', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const response = await api.get(`/me?fechaDesde=${yesterday.toISOString()}&limit=5`);
      return response.data;
    });
  }

  // ================================
  // PRUEBAS DE ENDPOINTS ADMINISTRATIVOS
  // ================================

  async testAdminEndpoints() {
    console.log('.👨‍💼 PROBANDO ENDPOINTS ADMINISTRATIVOS');

    await this.test('Listar todos los intercambios', async () => {
      const response = await api.get('/?limit=10');
      return response.data;
    });

    await this.test('Buscar intercambios', async () => {
      const response = await api.get('/search?q=test&limit=5');
      return response.data;
    });

    await this.test('Obtener estadísticas generales', async () => {
      const response = await api.get('/stats');
      return response.data;
    });

    if (TEST_DATA.intercambioId) {
      await this.test('Obtener intercambio por ID', async () => {
        const response = await api.get(`/${TEST_DATA.intercambioId}`);
        return response.data;
      });

      await this.test('Actualizar status de intercambio', async () => {
        const response = await api.put(`/${TEST_DATA.intercambioId}/status`, { 
          newStatus: 'completed' 
        });
        return response.data;
      });
    }

    await this.test('Obtener top traders', async () => {
      const response = await api.get('/analytics/top-traders?limit=5&period=30d');
      return response.data;
    });

    await this.test('Obtener resumen de mercado', async () => {
      const response = await api.get('/analytics/market-summary');
      return response.data;
    });

    await this.test('Obtener estadísticas por criptomoneda', async () => {
      const response = await api.get('/analytics/stats-by-crypto');
      return response.data;
    });
  }

  // ================================
  // PRUEBAS DE VALIDACIÓN
  // ================================

  async testValidations() {
    console.log('.🔍 PROBANDO VALIDACIONES');

    await this.test('Validación: Tipo inválido', async () => {
      try {
        await api.post('/', {
          pairId: TEST_DATA.pairId,
          type: 'invalido',
          baseAmount: 0.001,
          price: 45000
        });
      } catch (error) {
        if (error.response?.status === 400) {
          return { validation: 'working', error: error.response.data };
        }
        throw error;
      }
    });

    await this.test('Validación: Cantidad negativa', async () => {
      try {
        await api.post('/', {
          pairId: TEST_DATA.pairId,
          type: 'buy',
          baseAmount: -0.001,
          price: 45000
        });
      } catch (error) {
        if (error.response?.status === 400) {
          return { validation: 'working', error: error.response.data };
        }
        throw error;
      }
    });

    await this.test('Validación: UUID inválido', async () => {
      try {
        await axios.get(`${API_URL}/pairs/invalid-uuid/last-price`);
      } catch (error) {
        if (error.response?.status === 400) {
          return { validation: 'working', error: error.response.data };
        }
        throw error;
      }
    });

    await this.test('Validación: Búsqueda sin término', async () => {
      try {
        await api.get('/search');
      } catch (error) {
        if (error.response?.status === 400) {
          return { validation: 'working', error: error.response.data };
        }
        throw error;
      }
    });

    await this.test('Validación: Exceso de decimales', async () => {
      try {
        await api.post('/', {
          pairId: TEST_DATA.pairId,
          type: 'buy',
          baseAmount: 0.123456789, // 9 decimals (máximo 8)
          price: 45000
        });
      } catch (error) {
        if (error.response?.status === 400) {
          return { validation: 'working', error: error.response.data };
        }
        throw error;
      }
    });
  }

  // ================================
  // PRUEBAS DE FLUJO COMPLETO
  // ================================

  async testCompleteFlow() {
    console.log('.🔄 PROBANDO FLUJO COMPLETO');

    // 1. Verificar balances iniciales
    const initialBalances = await this.test('Flujo: Verificar balances iniciales', async () => {
      const response = await api.get('/me/balances');
      return response.data;
    });

    // 2. Calcular intercambio
    const calculation = await this.test('Flujo: Calcular intercambio', async () => {
      const response = await api.post('/calculate', {
        pairId: TEST_DATA.pairId,
        baseAmount: 0.0001,
        type: 'buy'
      });
      return response.data;
    });

    // 3. Verificar límites
    if (calculation) {
      await this.test('Flujo: Verificar límites', async () => {
        const response = await api.post('/check-limit', {
          quoteAmount: calculation.calculo?.finalAmount || 1
        });
        return response.data;
      });
    }

    // 4. Ejecutar intercambio (solo si hay fondos)
    const exchange = await this.test('Flujo: Ejecutar intercambio', async () => {
      const response = await api.post('/', {
        pairId: TEST_DATA.pairId,
        type: 'buy',
        baseAmount: 0.0001,
        price: 45000.00
      });
      return response.data;
    });

    // 5. Verificar balances después del intercambio
    await this.test('Flujo: Verificar balances después', async () => {
      const response = await api.get('/me/balances');
      return response.data;
    });

    // 6. Verificar volumen diario actualizado
    await this.test('Flujo: Verificar volumen diario', async () => {
      const response = await api.get('/me/daily-volume');
      return response.data;
    });

    // 7. Verificar historial de intercambios
    await this.test('Flujo: Verificar historial', async () => {
      const response = await api.get('/me?limit=5');
      return response.data;
    });
  }

  // ================================
  // PRUEBAS DE RENDIMIENTO BÁSICAS
  // ================================

  async testPerformance() {
    console.log('.⚡ PROBANDO RENDIMIENTO BÁSICO');

    await this.test('Rendimiento: 10 consultas de price', async () => {
      const start = Date.now();
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(axios.get(`${API_URL}/pairs/${TEST_DATA.pairId}/last-price`));
      }
      
      await Promise.all(promises);
      const end = Date.now();
      
      return {
        time: end - start,
        average: (end - start) / 10,
        requestsPerSecond: Math.round(10000 / (end - start))
      };
    });

    await this.test('Rendimiento: 5 cálculos simultáneos', async () => {
      const start = Date.now();
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(api.post('/calculate', {
          pairId: TEST_DATA.pairId,
          baseAmount: 0.001 * (i + 1),
          type: i % 2 === 0 ? 'buy' : 'sell'
        }));
      }
      
      await Promise.allSettled(promises);
      const end = Date.now();
      
      return {
        time: end - start,
        average: (end - start) / 5
      };
    });
  }

  // ================================
  // EJECUTAR TODAS LAS PRUEBAS
  // ================================

  async runAllTests() {
    console.log('🚀 INICIANDO PRUEBAS DEL EXCHANGE ADAPTADO');
    console.log('==========================================');

    await this.testPublicEndpoints();
    await this.testMainOperations();
    await this.testUserQueries();
    await this.testAdminEndpoints();
    await this.testValidations();
    await this.testCompleteFlow();
    await this.testPerformance();

    this.printSummary();
  }

  printSummary() {
    console.log('.📋 RESUMEN DE PRUEBAS');
    console.log('====================');
    
    const successful = this.results.filter(r => r.status === 'success').length;
    const failed = this.results.filter(r => r.status === 'error').length;
    
    console.log(`✅ Exitosas: ${successful}`);
    console.log(`❌ Fallidas: ${failed}`);
    console.log(`📊 Total: ${this.results.length}`);
    
    if (failed > 0) {
      console.log('.❌ PRUEBAS FALLIDAS:');
      this.results
        .filter(r => r.status === 'error')
        .forEach(r => {
          console.log(`   - ${r.name}`);
          if (r.error?.errors) {
            r.error.errors.forEach(err => console.log(`     * ${err.msg}`));
          } else {
            console.log(`     * ${r.error?.message || r.error}`);
          }
        });
    }

    console.log('.🎯 CONFIGURACIÓN NECESARIA:');
    console.log('1. Asegúrate de que el servidor esté corriendo en', BASE_URL);
    console.log('2. Actualiza el authToken con un token JWT válido');
    console.log('3. Reemplaza los TEST_DATA con IDs reales de tu base de datos');
    console.log('4. Asegúrate de tener balances suficientes para las pruebas');
    console.log('5. Verifica que tienes permisos de admin para las pruebas administrativas');
  }
}

// ================================
// EJECUCIÓN
// ================================

if (require.main === module) {
  const tester = new ExchangeTester();
  
  // Verificar configuración
  if (authToken === 'Bearer YOUR_JWT_TOKEN_HERE') {
    console.log('⚠️  ADVERTENCIA: Actualiza el authToken antes de ejecutar las pruebas');
    console.log('   Puedes obtenerlo haciendo login en tu aplicación');
  }
  
  tester.runAllTests().catch(console.error);
}

module.exports = ExchangeTester;

// ================================
// INSTRUCCIONES DE USO
// ================================

/*
INSTRUCCIONES PARA EJECUTAR LAS PRUEBAS:

1. Instalar dependencias:
   npm install axios

2. Configurar variables:
   - Actualizar BASE_URL con la URL de tu servidor
   - Obtener un token JWT válido y actualizarlo en authToken
   - Reemplazar los IDs en TEST_DATA con IDs reales de tu base de datos

3. Preparar datos de prueba:
   - Asegúrate de tener al menos un SwapPair active
   - Verifica que el usuario tenga balances en las criptomonedas del par
   - Confirma que el límite diario del usuario permita transacciones

4. Ejecutar las pruebas:
   node scripts/testExchange.js

5. Para pruebas específicas, puedes usar:
   const tester = new ExchangeTester();
   await tester.testMainOperations();
   await tester.testUserQueries();
   await tester.testAdminEndpoints();

EJEMPLOS DE CURL PARA PRUEBAS RÁPIDAS:

# Calcular intercambio (requiere auth)
curl -X POST "http://localhost:3000/api/intercambios/calculate" .
  -H "Content-Type: application/json" .
  -H "Authorization: Bearer YOUR_TOKEN" .
  -d '{
    "pairId": "PARID",
    "baseAmount": 0.001,
    "type": "buy"
  }'

# Ejecutar intercambio (requiere auth y fondos)
curl -X POST "http://localhost:3000/api/intercambios" .
  -H "Content-Type: application/json" .
  -H "Authorization: Bearer YOUR_TOKEN" .
  -d '{
    "pairId": "PARID",
    "type": "buy",
    "baseAmount": 0.001,
    "price": 45000.00
  }'

# Obtener mis balances
curl "http://localhost:3000/api/intercambios/me/balances" .
  -H "Authorization: Bearer YOUR_TOKEN"

# Obtener último price (público)
curl "http://localhost:3000/api/intercambios/pairs/PARID/last-price"
*/