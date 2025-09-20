/*

Quiero que actualices mi script scripts/test-apis.js, que actualmente hace requests a https://api-testnet.bscscan.com/api y https://api.bscscan.com/api, para que en su lugar use la nueva Etherscan API V2.

Puntos a tener en cuenta:

El endpoint unificado es:
https://api.etherscan.io/v2/api

Todas las chains EVM ahora se manejan con una sola API key, no necesito BSCSCAN_API_KEY separado.
Usa solo ETHERSCAN_API_KEY.

Para especificar la red se pasa el parámetro chainid:

Ethereum Sepolia: 11155111

Ethereum Mainnet: 1

BSC Mainnet: 56

BSC Testnet: 97
(y debe quedar fácil de extender si después agrego más chains).

El resto de los parámetros (module, action, address, startblock, endblock, sort) siguen igual.

Quiero que el script mantenga la misma lógica de logging que ya tenía:

Mostrar variables de entorno.

Construir la URL pero censurando el API key al loguearla.

Mostrar status, message y result.length.

✅ o ❌ según si la llamada funcionó.

Haceme ejemplos de tests para:

Ethereum Sepolia (chainid=11155111).

BSC Testnet (chainid=97).

BSC Mainnet (chainid=56).

En resumen: el script debe dejar de usar api-testnet.bscscan.com o api.bscscan.com y migrar completamente a api.etherscan.io/v2/api con chainid.

*/

// scripts/test-apis.js - Script para probar Etherscan API V2 unificada
require('dotenv').config();

// Configuración de chains
const CHAINS = {
  'ethereum-sepolia': {
    name: 'Ethereum Sepolia',
    chainid: 11155111,
    testAddress: '0xcffbe3720cacb04d21ba9b43b476263f46065e72'
  },
  'bsc-testnet': {
    name: 'BSC Testnet',
    chainid: 97,
    testAddress: '0xfef4878f910020a467736a445e283a61213f7081'
  },
  'bsc-mainnet': {
    name: 'BSC Mainnet',
    chainid: 56,
    testAddress: '0x742d35Cc6634C0532925a3b8D6FC0FDeA5aBDA10'
  },
  'ethereum-mainnet': {
    name: 'Ethereum Mainnet',
    chainid: 1,
    testAddress: '0x742d35Cc6634C0532925a3b8D6FC0FDeA5aBDA10'
  }
};

async function testEtherscanV2API() {
  console.log('🔧 =================== TEST ETHERSCAN API V2 ===================');
  
  // Verificar variables de entorno
  console.log('🔧 Variables de entorno:');
  console.log('  - ETHERSCAN_API_KEY:', process.env.ETHERSCAN_API_KEY ? 'Existe' : 'FALTA');
  console.log('  - BSC_NETWORK:', process.env.BSC_NETWORK);
  console.log('  - NODE_ENV:', process.env.NODE_ENV);
  
  if (process.env.ETHERSCAN_API_KEY) {
    console.log(`  - ETHERSCAN_API_KEY valor: ${process.env.ETHERSCAN_API_KEY.substring(0, 8)}...`);
  } else {
    console.log('❌ ETHERSCAN_API_KEY faltante - no se pueden ejecutar tests');
    return;
  }

  console.log('');

  // Test básico de validación de API key
  console.log('🔧 Test de validación básica de API key...');
  try {
    const validationUrl = `https://api.etherscan.io/v2/api?module=stats&action=ethprice&chainid=1&apikey=${process.env.ETHERSCAN_API_KEY}`;
    
    console.log('URL (censurada):', validationUrl.replace(process.env.ETHERSCAN_API_KEY, '***'));
    
    const response = await fetch(validationUrl);
    console.log('Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('Respuesta validación:', {
      status: data.status,
      message: data.message
    });
    
    if (data.status === '1') {
      console.log('✅ API Key Etherscan V2 válida');
    } else {
      console.log('❌ API Key Etherscan V2 inválida:', data.message);
      return;
    }
  } catch (error) {
    console.error('❌ Error validando API key:', error.message);
    return;
  }

  console.log('');

  // Tests para cada chain
  const chainsToTest = ['ethereum-sepolia', 'bsc-testnet', 'bsc-mainnet'];
  
  for (const chainKey of chainsToTest) {
    const chain = CHAINS[chainKey];
    console.log(`🔧 Testing ${chain.name} (chainid: ${chain.chainid})...`);
    
    try {
      const url = buildTransactionListUrl(chain.chainid, chain.testAddress);
      
      console.log('URL (censurada):', url.replace(process.env.ETHERSCAN_API_KEY, '***'));
      
      const response = await fetch(url);
      console.log('Status:', response.status, response.statusText);
      
      const data = await response.json();
      console.log('Respuesta:', {
        status: data.status,
        message: data.message,
        resultCount: data.result ? (Array.isArray(data.result) ? data.result.length : 'Not array') : 'N/A'
      });
      
      if (data.status === '1') {
        console.log(`✅ ${chain.name} API funcionando correctamente`);
        
        // Mostrar algunas transacciones si las hay
        if (data.result && Array.isArray(data.result) && data.result.length > 0) {
          console.log(`   📊 Últimas 3 transacciones:`);
          const lastTxs = data.result.slice(-3);
          lastTxs.forEach((tx, index) => {
            console.log(`     ${index + 1}. Hash: ${tx.hash.substring(0, 10)}... Block: ${tx.blockNumber} Value: ${tx.value}`);
          });
        }
      } else {
        console.log(`❌ ${chain.name} API con problemas: ${data.message}`);
      }
      
    } catch (error) {
      console.error(`❌ Error ${chain.name} API:`, error.message);
    }
    
    console.log('');
  }

  // Test adicional: obtener balance de una dirección
  console.log('🔧 Test adicional: Balance check...');
  try {
    const balanceUrl = buildBalanceUrl(CHAINS['ethereum-sepolia'].chainid, CHAINS['ethereum-sepolia'].testAddress);
    
    console.log('URL (censurada):', balanceUrl.replace(process.env.ETHERSCAN_API_KEY, '***'));
    
    const response = await fetch(balanceUrl);
    const data = await response.json();
    
    console.log('Balance check:', {
      status: data.status,
      message: data.message,
      result: data.result ? `${data.result.substring(0, 10)}... wei` : 'N/A'
    });
    
    if (data.status === '1') {
      console.log('✅ Balance check funcionando');
    } else {
      console.log('❌ Balance check con problemas:', data.message);
    }
  } catch (error) {
    console.error('❌ Error balance check:', error.message);
  }

  console.log('🔧 =================== FIN TEST ETHERSCAN V2 ===================');
}

function buildTransactionListUrl(chainid, address, startblock = 0, endblock = 'latest') {
  const baseUrl = 'https://api.etherscan.io/v2/api';
  const params = new URLSearchParams({
    module: 'account',
    action: 'txlist',
    address: address,
    startblock: startblock.toString(),
    endblock: endblock,
    sort: 'asc',
    chainid: chainid.toString(),
    apikey: process.env.ETHERSCAN_API_KEY
  });
  
  return `${baseUrl}?${params.toString()}`;
}

function buildBalanceUrl(chainid, address) {
  const baseUrl = 'https://api.etherscan.io/v2/api';
  const params = new URLSearchParams({
    module: 'account',
    action: 'balance',
    address: address,
    tag: 'latest',
    chainid: chainid.toString(),
    apikey: process.env.ETHERSCAN_API_KEY
  });
  
  return `${baseUrl}?${params.toString()}`;
}

function buildTokenTransactionUrl(chainid, address, contractaddress, startblock = 0, endblock = 'latest') {
  const baseUrl = 'https://api.etherscan.io/v2/api';
  const params = new URLSearchParams({
    module: 'account',
    action: 'tokentx',
    address: address,
    contractaddress: contractaddress,
    startblock: startblock.toString(),
    endblock: endblock,
    sort: 'asc',
    chainid: chainid.toString(),
    apikey: process.env.ETHERSCAN_API_KEY
  });
  
  return `${baseUrl}?${params.toString()}`;
}

// Función para obtener la configuración de una chain por nombre
function getChainConfig(networkName) {
  const mappings = {
    'ethereum': CHAINS['ethereum-mainnet'],
    'ethereum-mainnet': CHAINS['ethereum-mainnet'],
    'sepolia': CHAINS['ethereum-sepolia'],
    'ethereum-sepolia': CHAINS['ethereum-sepolia'],
    'bsc': CHAINS['bsc-mainnet'],
    'bsc-mainnet': CHAINS['bsc-mainnet'],
    'bsc-testnet': CHAINS['bsc-testnet']
  };
  
  return mappings[networkName] || null;
}

// Exportar funciones útiles para usar en otros archivos
module.exports = {
  testEtherscanV2API,
  buildTransactionListUrl,
  buildBalanceUrl,
  buildTokenTransactionUrl,
  getChainConfig,
  CHAINS
};

// Ejecutar si es llamado directamente
if (require.main === module) {
  testEtherscanV2API()
    .then(() => {
      console.log('✅ Test completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test falló:', error.message);
      process.exit(1);
    });
}