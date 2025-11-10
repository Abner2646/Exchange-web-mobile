// mobile/debug/checkEndpoints.js
// Script para verificar configuración de endpoints
// Ejecutar con: node debug/checkEndpoints.js

console.log('🔍 === VERIFICACIÓN DE ENDPOINTS ===\n');

// Importar endpoints (ajusta la ruta según tu estructura)
const ENDPOINTS = require('../api/endpoints');

console.log('📋 Endpoints de Trading configurados:\n');

// Listar todos los endpoints de trading
Object.keys(ENDPOINTS).forEach(key => {
  if (key.includes('TRADING')) {
    const endpoint = ENDPOINTS[key];
    console.log(`${key}:`);
    
    if (typeof endpoint === 'function') {
      console.log(`  → Función: ${endpoint.toString().split('=>')[1]?.trim() || 'dynamic'}`);
      console.log(`  → Ejemplo: ${endpoint(1)}`);
    } else {
      console.log(`  → ${endpoint}`);
    }
    console.log('');
  }
});

console.log('---\n');

// Endpoints que funcionan (según el usuario)
const workingEndpoints = [
  'MY_BALANCES',
  'SWAP_ESTIMATE',
  // Agregar aquí los endpoints que SÍ funcionan
];

console.log('✅ Endpoints que SÍ funcionan:\n');
workingEndpoints.forEach(key => {
  if (ENDPOINTS[key]) {
    console.log(`${key}: ${ENDPOINTS[key]}`);
  }
});

console.log('\n---\n');

// Verificar estructura
console.log('🔍 Análisis de estructura:\n');

if (ENDPOINTS.TRADING_PAIRS_ACTIVE) {
  console.log('TRADING_PAIRS_ACTIVE encontrado:');
  console.log(`  Valor: ${ENDPOINTS.TRADING_PAIRS_ACTIVE}`);
  console.log(`  Tipo: ${typeof ENDPOINTS.TRADING_PAIRS_ACTIVE}`);
} else {
  console.log('⚠️  TRADING_PAIRS_ACTIVE NO encontrado en ENDPOINTS');
}

console.log('\n---\n');

// Sugerencias
console.log('💡 Sugerencias:\n');
console.log('1. Compara TRADING_PAIRS_ACTIVE con un endpoint que SÍ funciona');
console.log('2. Verifica que la ruta sea consistente con el backend');
console.log('3. Verifica que no haya prefijos duplicados (/api/api)');
console.log('4. Revisa el archivo de rutas del backend (routes/trading.routes.js)');

console.log('\n=== FIN DE VERIFICACIÓN ===');