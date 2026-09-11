// services/blockchain/bsc.service.js - ACTUALIZADO PARA ETHERSCAN API V2
require('dotenv').config();
const { ethers } = require('ethers');
const { BlockchainTransaction, DepositAddress, Crypto, BlockchainState } = require('../../models');
const money = require('../../utils/money');
const EthersEvmClient = require('./ethersEvmClient');
const { bscNetworkProfile } = require('../../config/networks/evm');

class BscService {
  // Fase 3: identidad de network desde el NetworkProfile inyectable (default por env,
  // preservando `isTestnet = BSC_NETWORK==='testnet' || NODE_ENV!=='production'`).
  constructor(opts = {}) {
    try {
      const profile = opts.profile || bscNetworkProfile();
      this.profile = profile;
      this.isTestnet = profile.env === 'testnet';

      // Chain-client seam: injected in tests, built from env in prod. BSC is EVM,
      // so it reuses the same EvmChainClient port/adapter as Ethereum. Los secretos
      // (rpc url, private key) siguen en env; el perfil nombra qué key por entorno.
      if (opts.chainClient) {
        this.chain = opts.chainClient;
      } else {
        const rpcUrl = process.env[profile.rpcUrlEnv];
        const privateKey = process.env[profile.privateKeyEnv];
        if (!rpcUrl || !privateKey) {
          throw new Error(`Configuración BSC incompleta para ${this.isTestnet ? 'testnet' : 'mainnet'}`);
        }
        this.chain = new EthersEvmClient({ rpcUrl, privateKey, fallbackGwei: '5' });
      }

      // Legacy ethers handles for the not-yet-migrated paths (token withdrawal,
      // scan, confirmations). Real adapter exposes them; a fake leaves them null.
      this.provider = this.chain.provider || null;
      this.wallet = this.chain.wallet || null;
      this.network = profile.chain;               // 'bsc'
      this.actualNetwork = profile.actualNetwork; // 'bsc-testnet' | 'bsc'
      this.chainId = profile.chainId;
      this.requiredConfirmations = parseInt(process.env.BSC_REQUIRED_CONFIRMATIONS) || profile.requiredConfirmations;
      this.hasApiKey = !!process.env.ETHERSCAN_API_KEY;
      
      console.log(`BSC Service inicializado - Red: ${this.actualNetwork} (chainId: ${this.chainId}) - API: ${this.hasApiKey ? 'Disponible' : 'No disponible'}`);
      
    } catch (error) {
      console.error('❌ Error crítico en constructor BSC Service:', error.message);
      throw error;
    }
  }

  // MÉTODO PRINCIPAL CON API V2
  async scanForDeposits() {
    try {
      console.log(`🔍 [BSC] =================== INICIANDO ESCANEO BSC ===================`);
      console.log(`🔍 [BSC] Red: ${this.actualNetwork} (chainId: ${this.chainId})`);
      console.log(`🔍 [BSC] API Key disponible: ${this.hasApiKey}`);
      
      if (!this.hasApiKey || !process.env.ETHERSCAN_API_KEY) {
        console.error('❌ [BSC] API key faltante. NO SE PUEDE ESCANEAR BSC SIN API.');
        return [];
      }
      
      return await this.scanWithEtherscanV2API();
      
    } catch (error) {
      console.error('❌ [BSC] Error en escaneo principal:', error.message);
      console.error('❌ [BSC] Stack trace:', error.stack);
      return [];
    }
  }

  async scanWithEtherscanV2API() {
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
        console.log(`🔍 [BSC] Dirección ${index + 1}: ${dir.address} (${dir.crypto.symbol})`);
      });

      const lastProcessedBlock = await BlockchainState.getLastProcessedBlock(this.actualNetwork);
      console.log(`🔍 [BSC] Último bloque procesado: ${lastProcessedBlock}`);

      // Fix 2026-08-19 (AUDITORIA_BACKEND.md Altos #9): esto retrocedía
      // 10.000 bloques en CADA ciclo de escaneo (cada 60s por defecto),
      // marcado "TEMPORAL" pero nunca sacado — reconsultaba rangos ya
      // procesados todo el tiempo, carga redundante contra Etherscan y
      // más riesgo de rate-limit. ETH usa lastProcessedBlock directo, sin
      // este ajuste; BSC ahora hace lo mismo.
      const scanFromBlock = lastProcessedBlock;

      const newDeposits = [];

      for (let i = 0; i < direcciones.length; i++) {
        const address = direcciones[i];
        
        try {
          console.log(`🔍 [BSC] ================== ESCANEANDO DIRECCIÓN ${i + 1}/${direcciones.length} ==================`);
          console.log(`🔍 [BSC] Dirección: ${address.address}`);
          console.log(`🔍 [BSC] Crypto: ${address.crypto.symbol}`);
          console.log(`🔍 [BSC] Red en DB: ${address.crypto.network}`);
          console.log(`🔍 [BSC] Es token (tiene contrato): ${!!address.crypto.contractAddress}`);
          
          let deposits = [];
          
          if (address.crypto.symbol === 'BNB') {
            console.log(`🔍 [BSC] Escaneando transacciones BNB nativas...`);
            deposits = await this.scanBNBTransactions(address, scanFromBlock);
          } else if (address.crypto.contractAddress) {
            console.log(`🔍 [BSC] Escaneando transacciones BEP20 (${address.crypto.symbol})...`);
            console.log(`🔍 [BSC] Contrato: ${address.crypto.contractAddress}`);
            deposits = await this.scanBEP20Transactions(address, scanFromBlock);
          } else {
            console.warn(`⚠️ [BSC] Tipo de crypto no reconocido para ${address.crypto.symbol}`);
          }
          
          console.log(`🔍 [BSC] Depósitos encontrados para esta dirección: ${deposits.length}`);
          newDeposits.push(...deposits);
          
          // Pausa entre direcciones para evitar rate limiting
          if (i < direcciones.length - 1) {
            console.log(`🔍 [BSC] Pausa de 500ms antes de la siguiente dirección...`);
            await this.sleep(500);
          }
          
        } catch (error) {
          console.error(`❌ [BSC] Error escaneando dirección ${address.address}:`, error.message);
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
      console.error('❌ [BSC] Error en scanWithEtherscanV2API:', error.message);
      console.error('❌ [BSC] Stack trace:', error.stack);
      return [];
    }
  }

  async scanBNBTransactions(address, fromBlock) {
    const url = this.buildTransactionListUrl(address.address, fromBlock);

    try {
      console.log(`🔍 [BSC-BNB] URL de API: ${url.replace(process.env.ETHERSCAN_API_KEY, '***')}`);
      console.log(`🔍 [BSC-BNB] Consultando API para ${address.address}...`);
      console.log(`🔍 [BSC-BNB] ChainId: ${this.chainId}, Rango de bloques: ${fromBlock} a latest`);
      
      const response = await fetch(url);
      console.log(`🔍 [BSC-BNB] Respuesta HTTP: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`🔍 [BSC-BNB] Respuesta API:`, {
        status: data.status,
        message: data.message,
        resultCount: data.result ? (Array.isArray(data.result) ? data.result.length : 'Not array') : 'N/A'
      });

      if (data.status !== '1') {
        if (data.message === 'No transactions found') {
          console.log(`ℹ️ [BSC-BNB] No hay transacciones BNB para ${address.address}`);
          return [];
        } else {
          console.warn(`⚠️ [BSC-BNB] API warning: ${data.message}`);
          return [];
        }
      }

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
        
        const isIncoming = tx.to && tx.to.toLowerCase() === address.address.toLowerCase();
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
          
          const existing = await BlockchainTransaction.findOne({
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
          console.log(`  - User ID: ${address.userId}`);
          console.log(`  - Cantidad: ${amount} BNB`);
          console.log(`  - Fee: ${fee} BNB`);

          const newDeposit = await this.createDepositFromTransaction(
            address, tx, amount, fee
          );

          deposits.push(newDeposit);
          console.log(`✅ [BSC-BNB] Depósito creado exitosamente con ID: ${newDeposit.id}`);
        }
      }

      console.log(`📊 [BSC-BNB] Resumen para ${address.address}:`);
      console.log(`  - Total transacciones analizadas: ${transactions.length}`);
      console.log(`  - Transacciones entrantes: ${incomingTransactions}`);
      console.log(`  - Depósitos válidos: ${validDeposits}`);
      console.log(`  - Depósitos nuevos creados: ${deposits.length}`);

      return deposits;
    } catch (error) {
      console.error(`❌ [BSC-BNB] Error API para ${address.address}:`, error.message);
      console.error(`❌ [BSC-BNB] Stack trace:`, error.stack);
      return [];
    }
  }

  async scanBEP20Transactions(address, fromBlock) {
    const url = this.buildTokenTransactionUrl(address.address, address.crypto.contractAddress, fromBlock);

    try {
      console.log(`🔍 [BSC-BEP20] URL de API: ${url.replace(process.env.ETHERSCAN_API_KEY, '***')}`);
      console.log(`🔍 [BSC-BEP20] Consultando API para token ${address.crypto.symbol}...`);
      
      const response = await fetch(url);
      console.log(`🔍 [BSC-BEP20] Respuesta HTTP: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`🔍 [BSC-BEP20] Respuesta API:`, {
        status: data.status,
        message: data.message,
        resultCount: data.result ? (Array.isArray(data.result) ? data.result.length : 'Not array') : 'N/A'
      });

      if (data.status !== '1') {
        if (data.message === 'No transactions found') {
          console.log(`ℹ️ [BSC-BEP20] No hay transacciones ${address.crypto.symbol} para ${address.address}`);
          return [];
        } else {
          console.warn(`⚠️ [BSC-BEP20] API warning: ${data.message}`);
          return [];
        }
      }

      if (!data.result || !Array.isArray(data.result)) {
        console.warn(`⚠️ [BSC-BEP20] Respuesta sin datos válidos`);
        return [];
      }

      const transactions = data.result;
      console.log(`🔍 [BSC-BEP20] Procesando ${transactions.length} transacciones ${address.crypto.symbol}...`);

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
        
        const decimals = parseInt(tx.tokenDecimal);
        const amount = ethers.formatUnits(tx.value, decimals);
        console.log(`  - Amount formatted: ${amount} ${tx.tokenSymbol}`);
        
        const isIncoming = tx.to && tx.to.toLowerCase() === address.address.toLowerCase();
        console.log(`  - Es entrante: ${isIncoming}`);
        
        if (isIncoming) {
          incomingTransactions++;
          
          const existing = await BlockchainTransaction.findOne({
            where: { txHash: tx.hash }
          });

          if (existing) {
            console.log(`ℹ️ [BSC-BEP20] TX ${tx.hash} ya existe en DB, saltando...`);
            continue;
          }

          validDeposits++;
          console.log(`✅ [BSC-BEP20] TX ${tx.hash} es un depósito válido y nuevo!`);

          const fee = this.calculateTransactionFee(tx);

          console.log(`💰 [BSC-BEP20] Creando depósito ${address.crypto.symbol}:`);
          console.log(`  - User ID: ${address.userId}`);
          console.log(`  - Cantidad: ${amount} ${address.crypto.symbol}`);
          console.log(`  - Fee: ${fee} BNB`);

          const newDeposit = await this.createDepositFromTransaction(
            address, tx, amount, fee
          );

          deposits.push(newDeposit);
          console.log(`✅ [BSC-BEP20] Depósito creado exitosamente con ID: ${newDeposit.id}`);
        }
      }

      console.log(`📊 [BSC-BEP20] Resumen para ${address.address} (${address.crypto.symbol}):`);
      console.log(`  - Total transacciones analizadas: ${transactions.length}`);
      console.log(`  - Transacciones entrantes: ${incomingTransactions}`);
      console.log(`  - Depósitos válidos: ${validDeposits}`);
      console.log(`  - Depósitos nuevos creados: ${deposits.length}`);

      return deposits;
    } catch (error) {
      console.error(`❌ [BSC-BEP20] Error Token API para ${address.crypto.symbol}:`, error.message);
      console.error(`❌ [BSC-BEP20] Stack trace:`, error.stack);
      return [];
    }
  }

  // FUNCIONES AUXILIARES PARA API V2
  buildTransactionListUrl(address, startblock = 0, endblock = 'latest') {
    const baseUrl = 'https://api.etherscan.io/v2/api';
    const params = new URLSearchParams({
      module: 'account',
      action: 'txlist',
      address: address,
      startblock: startblock.toString(),
      endblock: endblock,
      sort: 'asc',
      chainid: this.chainId.toString(),
      apikey: process.env.ETHERSCAN_API_KEY
    });
    
    return `${baseUrl}?${params.toString()}`;
  }

  buildTokenTransactionUrl(address, contractaddress, startblock = 0, endblock = 'latest') {
    const baseUrl = 'https://api.etherscan.io/v2/api';
    const params = new URLSearchParams({
      module: 'account',
      action: 'tokentx',
      address: address,
      contractaddress: contractaddress,
      startblock: startblock.toString(),
      endblock: endblock,
      sort: 'asc',
      chainid: this.chainId.toString(),
      apikey: process.env.ETHERSCAN_API_KEY
    });
    
    return `${baseUrl}?${params.toString()}`;
  }

  async createDepositFromTransaction(address, tx, amount, fee) {
    try {
      console.log(`🔧 [BSC] Creando depósito en DB...`);

      const diff = money.subtract(String(amount), String(fee));
      const netAmount = money.compare(diff, '0') < 0 ? '0' : diff;

      const depositData = {
        userId: address.userId,
        cryptoId: address.cryptoId,
        amount: netAmount,
        destinationAddress: address.address,
        sourceAddress: tx.from,
        txHash: tx.hash,
        blockchainFee: String(fee),
        confirmations: parseInt(tx.confirmations || 0),
        requiredConfirmations: this.requiredConfirmations,
        blockNumber: parseInt(tx.blockNumber || 0),
        timestamp: new Date(parseInt(tx.timeStamp) * 1000)
      };
      
      console.log(`🔧 [BSC] Datos del depósito:`, depositData);
      
      const deposit = await BlockchainTransaction.createDeposit(depositData);
      
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

  async getActiveUserAddresses() {
    try {
      console.log(`🔧 [BSC] Buscando direcciones activas...`);
      console.log(`🔧 [BSC] Red configurada: ${this.actualNetwork}`);
      console.log(`🔧 [BSC] Es testnet: ${this.isTestnet}`);
      
      const redesToBuscar = this.isTestnet ? ['bsc', 'bsc-testnet'] : ['bsc', 'bsc-mainnet'];
      console.log(`🔧 [BSC] Redes a buscar: ${redesToBuscar.join(', ')}`);
      
      const direcciones = await DepositAddress.findAll({
        where: { active: true },
        include: [
          {
            model: Crypto,
            as: 'crypto',
            where: { 
              network: redesToBuscar,
              active: true 
            },
            attributes: ['id', 'symbol', 'name', 'network', 'contractAddress', 'decimals']
          }
        ]
      });
      
      console.log(`🔧 [BSC] Direcciones encontradas: ${direcciones.length}`);
      
      if (direcciones.length > 0) {
        direcciones.forEach((dir, index) => {
          console.log(`🔧 [BSC] Dirección ${index + 1}:`);
          console.log(`  - Dirección: ${dir.address}`);
          console.log(`  - Crypto: ${dir.crypto.symbol}`);
          console.log(`  - Red en DB: ${dir.crypto.network}`);
          console.log(`  - User ID: ${dir.userId}`);
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
      return ethers.formatEther(gasUsed * gasPrice);
    } catch (error) {
      return '0.001';
    }
  }

  // RESTO DE MÉTODOS (sin cambios significativos)
  async processPendingWithdrawals() {
    try {
      const pendingWithdrawals = await BlockchainTransaction.findAll({
        where: {
          type: 'withdrawal',
          status: 'pending'
        },
        include: [
          {
            model: Crypto,
            as: 'crypto',
            where: { network: this.actualNetwork }
          }
        ]
      });

      const processed = [];

      for (const withdrawal of pendingWithdrawals) {
        try {
          const result = await this.processWithdrawal(withdrawal);
          processed.push(result);
        } catch (error) {
          console.error(`❌ [BSC] Error procesando retiro ${withdrawal.id}:`, error.message);
          await BlockchainTransaction.failWithdrawal(withdrawal.id, error.message);
        }
      }

      return processed;
    } catch (error) {
      throw new Error(`Error procesando retiros BSC: ${error.message}`);
    }
  }

  async processWithdrawal(withdrawal) {
    const { amount, destinationAddress, crypto } = withdrawal;

    // Atomic claim BEFORE any broadcast (anti double-spend), for BOTH native and
    // token paths. If another concurrent run already claimed this row, skip.
    const claimed = await BlockchainTransaction.claimForProcessing(withdrawal.id);
    if (!claimed) {
      console.log(`⏭️ [BSC] Retiro ${withdrawal.id} ya reclamado por otra corrida, se saltea`);
      return null;
    }

    if (crypto.symbol === 'BNB') {
      // NATIVE — sign → pre-record txHash → broadcast → finalize (BSC is EVM).
      const walletBalance = await this.chain.getNativeBalance();
      if (money.compare(String(walletBalance), String(amount)) < 0) {
        throw new Error(`Balance insuficiente en wallet maestra BSC: ${walletBalance} < ${amount}`);
      }
      const { txHash, signed, fee } = await this.chain.signNativeTransfer(destinationAddress, amount.toString());
      await BlockchainTransaction.recordWithdrawalTxHash(withdrawal.id, txHash);
      await this.chain.broadcast(signed);
      const updated = await BlockchainTransaction.markWithdrawalAsSent(withdrawal.id, txHash, fee);
      console.log(`✅ [BSC] Retiro enviado: ${amount} ${crypto.symbol} - TX: ${txHash}`);
      return updated;
    }

    // TOKEN (BEP20) — sign → pre-record txHash → broadcast → finalize.
    const walletBalance = await this.chain.getTokenBalance(crypto.contractAddress);
    if (money.compare(String(walletBalance), String(amount)) < 0) {
      throw new Error(`Balance insuficiente en wallet maestra BSC: ${walletBalance} < ${amount}`);
    }
    const { txHash, signed, fee } = await this.chain.signTokenTransfer(crypto.contractAddress, destinationAddress, amount.toString());
    await BlockchainTransaction.recordWithdrawalTxHash(withdrawal.id, txHash);
    await this.chain.broadcast(signed);
    const updated = await BlockchainTransaction.markWithdrawalAsSent(withdrawal.id, txHash, fee);
    console.log(`✅ [BSC] Retiro enviado: ${amount} ${crypto.symbol} - TX: ${txHash}`);
    return updated;
  }

  async updateConfirmations() {
    try {
      // Buscar en ambas variantes de network para compatibilidad
      const redesToBuscar = this.isTestnet ? ['bsc', 'bsc-testnet'] : ['bsc', 'bsc-mainnet'];
      console.log(`🔄 [BSC] Buscando confirmaciones en redes: ${redesToBuscar.join(', ')}`);
      
      const pendingTxs = await BlockchainTransaction.findAll({
        where: {
          status: ['pending', 'processing'],
          txHash: { [require('sequelize').Op.ne]: null }
        },
        include: [
          {
            model: Crypto,
            as: 'crypto',
            where: { network: redesToBuscar }
          }
        ]
      });

      console.log(`🔄 [BSC] Encontradas ${pendingTxs.length} transacciones pendientes para actualizar`);

      const updated = [];

      for (const tx of pendingTxs) {
        try {
          console.log(`🔄 [BSC] Actualizando confirmaciones para TX: ${tx.txHash}`);
          
          const receipt = await this.provider.getTransactionReceipt(tx.txHash);
          
          if (receipt && receipt.blockNumber) {
            const currentBlock = await this.provider.getBlockNumber();
            const confirmations = currentBlock - receipt.blockNumber;
            
            console.log(`🔄 [BSC] TX ${tx.txHash}: ${confirmations} confirmaciones (requiere ${tx.requiredConfirmations})`);
            
            if (confirmations !== tx.confirmations) {
              const updatedTx = await BlockchainTransaction.updateConfirmations(
                tx.id,
                confirmations,
                tx.txHash
              );
              updated.push(updatedTx);
              
              console.log(`✅ [BSC] Confirmaciones actualizadas ${tx.txHash}: ${confirmations}`);
              
              // Si es un depósito que se acaba de confirmar, el balance debería actualizarse automáticamente
              if (tx.type === 'deposit' && confirmations >= tx.requiredConfirmations && tx.confirmations < tx.requiredConfirmations) {
                console.log(`🎉 [BSC] Depósito confirmado! Balance del usuario debería actualizarse automáticamente`);
              }
            }
          } else {
            console.log(`⚠️ [BSC] No se pudo obtener receipt para TX: ${tx.txHash}`);
          }
        } catch (error) {
          console.error(`❌ [BSC] Error actualizando confirmaciones ${tx.txHash}:`, error.message);
        }
      }

      return updated;
    } catch (error) {
      throw new Error(`Error actualizando confirmaciones BSC: ${error.message}`);
    }
  }

  async getWalletBalance(crypto) {
    if (crypto.contractAddress) {
      const contract = new ethers.Contract(
        crypto.contractAddress,
        [
          'function balanceOf(address) view returns (uint256)', 
          'function decimals() view returns (uint8)'
        ],
        this.provider
      );
      
      const balance = await contract.balanceOf(this.wallet.address);
      const decimals = await contract.decimals();
      return ethers.formatUnits(balance, decimals);
    } else {
      const balance = await this.provider.getBalance(this.wallet.address);
      return ethers.formatEther(balance);
    }
  }

  async validateAddress(address) {
    try {
      return ethers.isAddress(address);
    } catch (error) {
      return false;
    }
  }

}

module.exports = BscService;