// services/blockchain/bsc.service.js - VERSIÓN COMPLETA CON DEBUG DETALLADO
require('dotenv').config();
const { ethers } = require('ethers');
const { TransaccionBlockchain, DireccionDeposito, Criptomoneda, BlockchainState } = require('../../models');

class BscService {
  constructor() {
    try {
      console.log('🔧 [BSC] Iniciando constructor...');
      
      this.isTestnet = process.env.BSC_NETWORK === 'testnet' || process.env.NODE_ENV !== 'production';
      console.log('🔧 [BSC] Es testnet:', this.isTestnet);
      
      const rpcUrl = this.isTestnet ? process.env.BSC_TESTNET_RPC_URL : process.env.BSC_RPC_URL;
      const privateKey = this.isTestnet ? process.env.BNB_TESTNET_PRIVATE_KEY : process.env.BNB_PRIVATE_KEY;
      
      if (!rpcUrl || !privateKey) {
        throw new Error(`Configuración BSC incompleta para ${this.isTestnet ? 'testnet' : 'mainnet'}`);
      }
      
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.network = 'bsc';
      this.actualNetwork = this.isTestnet ? 'bsc-testnet' : 'bsc';
      this.requiredConfirmations = parseInt(process.env.BSC_REQUIRED_CONFIRMATIONS) || 6;
      this.hasApiKey = !!process.env.BSCSCAN_API_KEY;
      
      console.log(`✅ BSC Service inicializado - Red: ${this.actualNetwork} - API: ${this.hasApiKey ? 'Disponible' : 'No disponible'}`);
      
    } catch (error) {
      console.error('❌ Error crítico en constructor BSC Service:', error.message);
      throw error;
    }
  }

  // MÉTODO PRINCIPAL CON DEBUG COMPLETO
  async scanForDeposits() {
    try {
      console.log(`🔍 [BSC] =================== INICIANDO ESCANEO BSC ===================`);
      console.log(`🔍 [BSC] Red: ${this.actualNetwork}`);
      console.log(`🔍 [BSC] API Key disponible: ${this.hasApiKey}`);
      
      if (!this.hasApiKey || !process.env.BSCSCAN_API_KEY) {
        console.error('❌ [BSC] API key faltante. NO SE PUEDE ESCANEAR BSC SIN API.');
        return [];
      }
      
      return await this.scanWithBscScanAPI();
      
    } catch (error) {
      console.error('❌ [BSC] Error en escaneo principal:', error.message);
      console.error('❌ [BSC] Stack trace:', error.stack);
      return [];
    }
  }

  async scanWithBscScanAPI() {
    try {
      console.log(`🔍 [BSC] Obteniendo direcciones activas...`);
      const direcciones = await this.getActiveUserAddresses();
      
      console.log(`🔍 [BSC] Direcciones encontradas: ${direcciones.length}`);
      
      if (direcciones.length === 0) {
        console.log('ℹ️ [BSC] No hay direcciones activas para escanear');
        return [];
      }

      // Log de direcciones encontradas
      direcciones.forEach((dir, index) => {
        console.log(`🔍 [BSC] Dirección ${index + 1}: ${dir.direccion} (${dir.criptomoneda.symbol})`);
      });

      const lastProcessedBlock = await BlockchainState.getLastProcessedBlock(this.actualNetwork);
      console.log(`🔍 [BSC] Último bloque procesado: ${lastProcessedBlock}`);

      const newDeposits = [];

      for (let i = 0; i < direcciones.length; i++) {
        const direccion = direcciones[i];
        
        try {
          console.log(`🔍 [BSC] ================== ESCANEANDO DIRECCIÓN ${i + 1}/${direcciones.length} ==================`);
          console.log(`🔍 [BSC] Dirección: ${direccion.direccion}`);
          console.log(`🔍 [BSC] Criptomoneda: ${direccion.criptomoneda.symbol}`);
          console.log(`🔍 [BSC] Red en DB: ${direccion.criptomoneda.red}`);
          console.log(`🔍 [BSC] Es token (tiene contrato): ${!!direccion.criptomoneda.direccionContrato}`);
          
          let deposits = [];
          
          if (direccion.criptomoneda.symbol === 'BNB') {
            console.log(`🔍 [BSC] Escaneando transacciones BNB nativas...`);
            deposits = await this.scanBNBTransactions(direccion, lastProcessedBlock);
          } else if (direccion.criptomoneda.direccionContrato) {
            console.log(`🔍 [BSC] Escaneando transacciones BEP20 (${direccion.criptomoneda.symbol})...`);
            console.log(`🔍 [BSC] Contrato: ${direccion.criptomoneda.direccionContrato}`);
            deposits = await this.scanBEP20Transactions(direccion, lastProcessedBlock);
          } else {
            console.warn(`⚠️ [BSC] Tipo de criptomoneda no reconocido para ${direccion.criptomoneda.symbol}`);
          }
          
          console.log(`🔍 [BSC] Depósitos encontrados para esta dirección: ${deposits.length}`);
          newDeposits.push(...deposits);
          
          // Pausa entre direcciones para evitar rate limiting
          if (i < direcciones.length - 1) {
            console.log(`🔍 [BSC] Pausa de 500ms antes de la siguiente dirección...`);
            await this.sleep(500);
          }
          
        } catch (error) {
          console.error(`❌ [BSC] Error escaneando dirección ${direccion.direccion}:`, error.message);
          console.error(`❌ [BSC] Stack trace:`, error.stack);
        }
      }

      // Actualizar último bloque en DB
      if (newDeposits.length > 0 || lastProcessedBlock === 0) {
        try {
          console.log(`🔍 [BSC] Obteniendo bloque actual...`);
          const currentBlock = await this.provider.getBlockNumber();
          console.log(`🔍 [BSC] Bloque actual: ${currentBlock}`);
          
          await BlockchainState.updateLastProcessedBlock(this.actualNetwork, currentBlock);
          
          if (newDeposits.length > 0) {
            await BlockchainState.incrementDepositsFound(this.actualNetwork, newDeposits.length);
          }
          
          console.log(`✅ [BSC] Último bloque actualizado a: ${currentBlock}`);
        } catch (blockError) {
          console.error('⚠️ [BSC] Error actualizando último bloque:', blockError.message);
        }
      }

      console.log(`✅ [BSC] =================== ESCANEO BSC COMPLETADO ===================`);
      console.log(`✅ [BSC] Total depósitos encontrados: ${newDeposits.length}`);
      console.log(`✅ [BSC] Direcciones escaneadas: ${direcciones.length}`);
      
      return newDeposits;

    } catch (error) {
      console.error('❌ [BSC] Error en scanWithBscScanAPI:', error.message);
      console.error('❌ [BSC] Stack trace:', error.stack);
      return [];
    }
  }

  async scanBNBTransactions(direccion, fromBlock) {
    const apiUrl = this.getBscScanApiUrl();
    
    // Si el fromBlock es muy alto, intentar con uno más bajo
    let startBlock = fromBlock;
    if (fromBlock > 65000000) {
      startBlock = Math.max(0, fromBlock - 1000); // Retroceder 1000 bloques
      console.log(`🔧 [BSC-BNB] Bloque de inicio muy alto (${fromBlock}), intentando con ${startBlock}`);
    }
    
    const url = `${apiUrl}?module=account&action=txlist&address=${direccion.direccion}&startblock=${startBlock}&endblock=latest&sort=asc&apikey=${process.env.BSCSCAN_API_KEY}`;

    try {
      console.log(`🔍 [BSC-BNB] URL de API: ${url.replace(process.env.BSCSCAN_API_KEY, '***')}`);
      console.log(`🔍 [BSC-BNB] Consultando API para ${direccion.direccion}...`);
      console.log(`🔍 [BSC-BNB] Rango de bloques: ${startBlock} a latest`);
      
      const response = await fetch(url);
      console.log(`🔍 [BSC-BNB] Respuesta HTTP: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`🔍 [BSC-BNB] Respuesta API completa:`, JSON.stringify(data, null, 2));

      // MANEJO DETALLADO DE RESPUESTAS DE API
      if (data.status === '0') {
        if (data.message === 'No transactions found') {
          console.log(`ℹ️ [BSC-BNB] No hay transacciones BNB para ${direccion.direccion}`);
          return [];
        } else if (data.message === 'NOTOK') {
          // Verificar si hay resultados a pesar del NOTOK
          if (data.result && Array.isArray(data.result) && data.result.length > 0) {
            console.log(`🔧 [BSC-BNB] NOTOK pero con ${data.result.length} resultados - procesando de todos modos`);
            // Continuar con el procesamiento
          } else {
            console.warn(`⚠️ [BSC-BNB] API devolvió NOTOK y sin resultados útiles.`);
            console.warn(`⚠️ [BSC-BNB] Esto puede indicar:`);
            console.warn(`    - Dirección nueva sin transacciones`);
            console.warn(`    - Rate limiting (pausando 2 segundos)`);
            console.warn(`    - Problema temporal de API`);
            console.warn(`    - Bloque de inicio demasiado alto`);
            await this.sleep(2000);
            return [];
          }
        } else {
          console.warn(`⚠️ [BSC-BNB] API warning: ${data.message}`);
          return [];
        }
      }

      // Verificar que tenemos datos válidos
      if (!data.result || !Array.isArray(data.result)) {
        console.warn(`⚠️ [BSC-BNB] Respuesta sin datos válidos`);
        return [];
      }

      const transactions = data.result;
      console.log(`🔍 [BSC-BNB] Procesando ${transactions.length} transacciones...`);

      const deposits = [];
      let incomingTransactions = 0;
      let validDeposits = 0;
      
      for (const tx of transactions) {
        console.log(`🔍 [BSC-BNB] TX ${tx.hash}:`);
        console.log(`  - From: ${tx.from}`);
        console.log(`  - To: ${tx.to}`);
        console.log(`  - Value: ${tx.value} wei (${ethers.formatEther(tx.value)} BNB)`);
        console.log(`  - IsError: ${tx.isError}`);
        console.log(`  - Block: ${tx.blockNumber}`);
        console.log(`  - Timestamp: ${new Date(parseInt(tx.timeStamp) * 1000).toISOString()}`);
        
        // CONDICIONES PARA QUE SEA UN DEPÓSITO VÁLIDO
        const isIncoming = tx.to && tx.to.toLowerCase() === direccion.direccion.toLowerCase();
        const hasValue = parseFloat(tx.value) > 0;
        const isSuccessful = tx.isError === '0';
        
        console.log(`  - Es entrante: ${isIncoming}`);
        console.log(`  - Tiene valor: ${hasValue}`);
        console.log(`  - Es exitosa: ${isSuccessful}`);
        
        if (isIncoming) {
          incomingTransactions++;
        }
        
        if (isIncoming && hasValue && isSuccessful) {
          validDeposits++;
          
          // VERIFICAR que no existe en DB
          console.log(`🔍 [BSC-BNB] Verificando si TX ${tx.hash} ya existe en DB...`);
          const existing = await TransaccionBlockchain.findOne({
            where: { txHash: tx.hash }
          });

          if (existing) {
            console.log(`ℹ️ [BSC-BNB] TX ${tx.hash} ya existe en DB, saltando...`);
            continue;
          }

          console.log(`✅ [BSC-BNB] TX ${tx.hash} es un depósito válido y nuevo!`);
          
          const amount = ethers.formatEther(tx.value);
          const fee = this.calculateTransactionFee(tx);

          console.log(`💰 [BSC-BNB] Creando depósito:`);
          console.log(`  - Usuario ID: ${direccion.userId}`);
          console.log(`  - Cantidad: ${amount} BNB`);
          console.log(`  - Fee: ${fee} BNB`);
          console.log(`  - Cantidad neta: ${Math.max(0, parseFloat(amount) - parseFloat(fee))} BNB`);

          const newDeposit = await this.createDepositFromTransaction(
            direccion, tx, amount, fee
          );

          deposits.push(newDeposit);
          console.log(`✅ [BSC-BNB] Depósito creado exitosamente con ID: ${newDeposit.id}`);
        }
      }

      console.log(`📊 [BSC-BNB] Resumen para ${direccion.direccion}:`);
      console.log(`  - Total transacciones analizadas: ${transactions.length}`);
      console.log(`  - Transacciones entrantes: ${incomingTransactions}`);
      console.log(`  - Depósitos válidos: ${validDeposits}`);
      console.log(`  - Depósitos nuevos creados: ${deposits.length}`);

      return deposits;
    } catch (error) {
      console.error(`❌ [BSC-BNB] Error API para ${direccion.direccion}:`, error.message);
      console.error(`❌ [BSC-BNB] Stack trace:`, error.stack);
      return [];
    }
  }

  async scanBEP20Transactions(direccion, fromBlock) {
    const apiUrl = this.getBscScanApiUrl();
    const url = `${apiUrl}?module=account&action=tokentx&contractaddress=${direccion.criptomoneda.direccionContrato}&address=${direccion.direccion}&startblock=${fromBlock}&endblock=latest&sort=asc&apikey=${process.env.BSCSCAN_API_KEY}`;

    try {
      console.log(`🔍 [BSC-BEP20] URL de API: ${url.replace(process.env.BSCSCAN_API_KEY, '***')}`);
      console.log(`🔍 [BSC-BEP20] Consultando API para token ${direccion.criptomoneda.symbol}...`);
      
      const response = await fetch(url);
      console.log(`🔍 [BSC-BEP20] Respuesta HTTP: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`🔍 [BSC-BEP20] Respuesta API:`, {
        status: data.status,
        message: data.message,
        resultCount: data.result ? data.result.length : 'N/A'
      });

      if (data.status === '0') {
        if (data.message === 'No transactions found') {
          console.log(`ℹ️ [BSC-BEP20] No hay transacciones ${direccion.criptomoneda.symbol} para ${direccion.direccion}`);
          return [];
        } else if (data.message === 'NOTOK') {
          console.warn(`⚠️ [BSC-BEP20] API devolvió NOTOK para token ${direccion.criptomoneda.symbol}`);
          await this.sleep(2000);
          return [];
        } else {
          console.warn(`⚠️ [BSC-BEP20] API warning para token: ${data.message}`);
          return [];
        }
      }

      if (data.status !== '1' || !data.result || !Array.isArray(data.result)) {
        console.warn(`⚠️ [BSC-BEP20] Respuesta inesperada de API`);
        return [];
      }

      const transactions = data.result;
      console.log(`🔍 [BSC-BEP20] Analizando ${transactions.length} transacciones ${direccion.criptomoneda.symbol}...`);

      const deposits = [];
      let incomingTransactions = 0;
      let validDeposits = 0;
      
      for (const tx of transactions) {
        console.log(`🔍 [BSC-BEP20] TX ${tx.hash}:`);
        console.log(`  - From: ${tx.from}`);
        console.log(`  - To: ${tx.to}`);
        console.log(`  - Value: ${tx.value} (${tx.tokenSymbol})`);
        console.log(`  - Token Decimal: ${tx.tokenDecimal}`);
        console.log(`  - Block: ${tx.blockNumber}`);
        
        const decimales = parseInt(tx.tokenDecimal);
        const amount = ethers.formatUnits(tx.value, decimales);
        console.log(`  - Amount formatted: ${amount} ${tx.tokenSymbol}`);
        
        const isIncoming = tx.to && tx.to.toLowerCase() === direccion.direccion.toLowerCase();
        console.log(`  - Es entrante: ${isIncoming}`);
        
        if (isIncoming) {
          incomingTransactions++;
          
          const existing = await TransaccionBlockchain.findOne({
            where: { txHash: tx.hash }
          });

          if (existing) {
            console.log(`ℹ️ [BSC-BEP20] TX ${tx.hash} ya existe en DB, saltando...`);
            continue;
          }

          validDeposits++;
          console.log(`✅ [BSC-BEP20] TX ${tx.hash} es un depósito válido y nuevo!`);

          const fee = this.calculateTransactionFee(tx);

          console.log(`💰 [BSC-BEP20] Creando depósito ${direccion.criptomoneda.symbol}:`);
          console.log(`  - Usuario ID: ${direccion.userId}`);
          console.log(`  - Cantidad: ${amount} ${direccion.criptomoneda.symbol}`);
          console.log(`  - Fee: ${fee} BNB`);

          const newDeposit = await this.createDepositFromTransaction(
            direccion, tx, amount, fee
          );

          deposits.push(newDeposit);
          console.log(`✅ [BSC-BEP20] Depósito creado exitosamente con ID: ${newDeposit.id}`);
        }
      }

      console.log(`📊 [BSC-BEP20] Resumen para ${direccion.direccion} (${direccion.criptomoneda.symbol}):`);
      console.log(`  - Total transacciones analizadas: ${transactions.length}`);
      console.log(`  - Transacciones entrantes: ${incomingTransactions}`);
      console.log(`  - Depósitos válidos: ${validDeposits}`);
      console.log(`  - Depósitos nuevos creados: ${deposits.length}`);

      return deposits;
    } catch (error) {
      console.error(`❌ [BSC-BEP20] Error Token API para ${direccion.criptomoneda.symbol}:`, error.message);
      console.error(`❌ [BSC-BEP20] Stack trace:`, error.stack);
      return [];
    }
  }

  async createDepositFromTransaction(direccion, tx, amount, fee) {
    try {
      console.log(`🔧 [BSC] Creando depósito en DB...`);
      
      const depositData = {
        userId: direccion.userId,
        criptomonedaId: direccion.criptomonedaId,
        cantidad: Math.max(0, parseFloat(amount) - parseFloat(fee)),
        direccionDestino: direccion.direccion,
        direccionOrigen: tx.from,
        txHash: tx.hash,
        feeBlockchain: parseFloat(fee),
        confirmaciones: parseInt(tx.confirmations || 0),
        confirmacionesRequeridas: this.requiredConfirmations,
        blockNumber: parseInt(tx.blockNumber || 0),
        timestamp: new Date(parseInt(tx.timeStamp) * 1000)
      };
      
      console.log(`🔧 [BSC] Datos del depósito:`, depositData);
      
      const deposit = await TransaccionBlockchain.createDeposit(depositData);
      
      console.log(`✅ [BSC] Depósito creado en DB con ID: ${deposit.id}`);
      return deposit;
      
    } catch (error) {
      console.error(`❌ [BSC] Error creando depósito en DB:`, error.message);
      console.error(`❌ [BSC] Stack trace:`, error.stack);
      throw error;
    }
  }

  // MÉTODOS AUXILIARES
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getBscScanApiUrl() {
    const url = this.isTestnet 
      ? 'https://api-testnet.bscscan.com/api'
      : 'https://api.bscscan.com/api';
    console.log(`🔧 [BSC] Usando API URL: ${url}`);
    return url;
  }

  async getActiveUserAddresses() {
    try {
      console.log(`🔧 [BSC] Buscando direcciones activas...`);
      console.log(`🔧 [BSC] Red configurada: ${this.actualNetwork}`);
      console.log(`🔧 [BSC] Es testnet: ${this.isTestnet}`);
      
      // Buscar tanto 'bsc' como 'bsc-testnet' para compatibilidad
      const redesToBuscar = this.isTestnet ? ['bsc', 'bsc-testnet'] : ['bsc', 'bsc-mainnet'];
      console.log(`🔧 [BSC] Redes a buscar: ${redesToBuscar.join(', ')}`);
      
      const direcciones = await DireccionDeposito.findAll({
        where: { activa: true },
        include: [
          {
            model: Criptomoneda,
            as: 'criptomoneda',
            where: { 
              red: redesToBuscar, // Buscar en ambas variantes
              activa: true 
            },
            attributes: ['id', 'symbol', 'nombre', 'red', 'direccionContrato', 'decimales']
          }
        ]
      });
      
      console.log(`🔧 [BSC] Direcciones encontradas: ${direcciones.length}`);
      
      // Log detallado de lo que encontró
      if (direcciones.length > 0) {
        direcciones.forEach((dir, index) => {
          console.log(`🔧 [BSC] Dirección ${index + 1}:`);
          console.log(`  - Dirección: ${dir.direccion}`);
          console.log(`  - Criptomoneda: ${dir.criptomoneda.symbol}`);
          console.log(`  - Red en DB: ${dir.criptomoneda.red}`);
          console.log(`  - Usuario ID: ${dir.userId}`);
        });
      }
      
      return direcciones;
    } catch (error) {
      console.error('❌ [BSC] Error obteniendo direcciones:', error.message);
      console.error('❌ [BSC] Stack trace:', error.stack);
      return [];
    }
  }

  calculateTransactionFee(tx) {
    try {
      const gasUsed = BigInt(tx.gasUsed || 21000);
      const gasPrice = BigInt(tx.gasPrice || 5000000000);
      return parseFloat(ethers.formatEther(gasUsed * gasPrice));
    } catch (error) {
      return 0.001;
    }
  }

  // MÉTODOS RESTANTES (simplificados para esta versión de debug)
  async processPendingWithdrawals() {
    return [];
  }

  async updateConfirmations() {
    return [];
  }

  async validateAddress(address) {
    try {
      return ethers.isAddress(address);
    } catch (error) {
      return false;
    }
  }

  async getBalance(address, contractAddress = null) {
    try {
      if (contractAddress) {
        const contract = new ethers.Contract(
          contractAddress, 
          ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'], 
          this.provider
        );
        const balance = await contract.balanceOf(address);
        const decimales = await contract.decimals();
        return ethers.formatUnits(balance, decimales);
      } else {
        const balance = await this.provider.getBalance(address);
        return ethers.formatEther(balance);
      }
    } catch (error) {
      throw new Error(`Error obteniendo balance BSC: ${error.message}`);
    }
  }
}

module.exports = BscService;