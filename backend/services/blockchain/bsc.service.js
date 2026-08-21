// services/blockchain/bsc.service.js - ACTUALIZADO PARA ETHERSCAN API V2
require('dotenv').config();
const { ethers } = require('ethers');
const { TransaccionBlockchain, DireccionDeposito, Criptomoneda, BlockchainState } = require('../../models');

class BscService {
  constructor() {
    try {
      this.isTestnet = process.env.BSC_NETWORK === 'testnet' || process.env.NODE_ENV !== 'production';
      
      const rpcUrl = this.isTestnet ? process.env.BSC_TESTNET_RPC_URL : process.env.BSC_RPC_URL;
      const privateKey = this.isTestnet ? process.env.BNB_TESTNET_PRIVATE_KEY : process.env.BNB_PRIVATE_KEY;
      
      if (!rpcUrl || !privateKey) {
        throw new Error(`Configuración BSC incompleta para ${this.isTestnet ? 'testnet' : 'mainnet'}`);
      }
      
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.network = 'bsc';
      this.actualNetwork = this.isTestnet ? 'bsc-testnet' : 'bsc';
      this.chainId = this.isTestnet ? 97 : 56; // BSC Testnet : BSC Mainnet
      this.requiredConfirmations = parseInt(process.env.BSC_REQUIRED_CONFIRMATIONS) || 6;
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
        console.log(`🔍 [BSC] Dirección ${index + 1}: ${dir.direccion} (${dir.criptomoneda.symbol})`);
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
            deposits = await this.scanBNBTransactions(direccion, scanFromBlock);
          } else if (direccion.criptomoneda.direccionContrato) {
            console.log(`🔍 [BSC] Escaneando transacciones BEP20 (${direccion.criptomoneda.symbol})...`);
            console.log(`🔍 [BSC] Contrato: ${direccion.criptomoneda.direccionContrato}`);
            deposits = await this.scanBEP20Transactions(direccion, scanFromBlock);
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
      console.error('❌ [BSC] Error en scanWithEtherscanV2API:', error.message);
      console.error('❌ [BSC] Stack trace:', error.stack);
      return [];
    }
  }

  async scanBNBTransactions(direccion, fromBlock) {
    const url = this.buildTransactionListUrl(direccion.direccion, fromBlock);

    try {
      console.log(`🔍 [BSC-BNB] URL de API: ${url.replace(process.env.ETHERSCAN_API_KEY, '***')}`);
      console.log(`🔍 [BSC-BNB] Consultando API para ${direccion.direccion}...`);
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
          console.log(`ℹ️ [BSC-BNB] No hay transacciones BNB para ${direccion.direccion}`);
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
    const url = this.buildTokenTransactionUrl(direccion.direccion, direccion.criptomoneda.direccionContrato, fromBlock);

    try {
      console.log(`🔍 [BSC-BEP20] URL de API: ${url.replace(process.env.ETHERSCAN_API_KEY, '***')}`);
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
        resultCount: data.result ? (Array.isArray(data.result) ? data.result.length : 'Not array') : 'N/A'
      });

      if (data.status !== '1') {
        if (data.message === 'No transactions found') {
          console.log(`ℹ️ [BSC-BEP20] No hay transacciones ${direccion.criptomoneda.symbol} para ${direccion.direccion}`);
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
      console.log(`🔍 [BSC-BEP20] Procesando ${transactions.length} transacciones ${direccion.criptomoneda.symbol}...`);

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

  async getActiveUserAddresses() {
    try {
      console.log(`🔧 [BSC] Buscando direcciones activas...`);
      console.log(`🔧 [BSC] Red configurada: ${this.actualNetwork}`);
      console.log(`🔧 [BSC] Es testnet: ${this.isTestnet}`);
      
      const redesToBuscar = this.isTestnet ? ['bsc', 'bsc-testnet'] : ['bsc', 'bsc-mainnet'];
      console.log(`🔧 [BSC] Redes a buscar: ${redesToBuscar.join(', ')}`);
      
      const direcciones = await DireccionDeposito.findAll({
        where: { activa: true },
        include: [
          {
            model: Criptomoneda,
            as: 'criptomoneda',
            where: { 
              red: redesToBuscar,
              activa: true 
            },
            attributes: ['id', 'symbol', 'nombre', 'red', 'direccionContrato', 'decimales']
          }
        ]
      });
      
      console.log(`🔧 [BSC] Direcciones encontradas: ${direcciones.length}`);
      
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

  // RESTO DE MÉTODOS (sin cambios significativos)
  async processPendingWithdrawals() {
    try {
      const pendingWithdrawals = await TransaccionBlockchain.findAll({
        where: {
          tipo: 'retiro',
          estado: 'pendiente'
        },
        include: [
          {
            model: Criptomoneda,
            as: 'criptomoneda',
            where: { red: this.actualNetwork }
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
          await TransaccionBlockchain.failWithdrawal(withdrawal.id, error.message);
        }
      }

      return processed;
    } catch (error) {
      throw new Error(`Error procesando retiros BSC: ${error.message}`);
    }
  }

  async processWithdrawal(withdrawal) {
    const { cantidad, direccionDestino, criptomoneda } = withdrawal;

    const walletBalance = await this.getWalletBalance(criptomoneda);
    if (walletBalance < parseFloat(cantidad)) {
      throw new Error(`Balance insuficiente en wallet maestra BSC: ${walletBalance} < ${cantidad}`);
    }

    let tx;
    let estimatedFee;

    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('5', 'gwei');

    try {
      if (criptomoneda.symbol === 'BNB') {
        estimatedFee = parseFloat(ethers.formatEther(gasPrice * BigInt(21000)));
        
        tx = await this.wallet.sendTransaction({
          to: direccionDestino,
          value: ethers.parseEther(cantidad.toString()),
          gasLimit: 21000,
          gasPrice: gasPrice
        });
      } else {
        const contract = new ethers.Contract(
          criptomoneda.direccionContrato,
          [
            'function transfer(address to, uint256 amount) returns (bool)',
            'function decimals() view returns (uint8)'
          ],
          this.wallet
        );

        estimatedFee = parseFloat(ethers.formatEther(gasPrice * BigInt(60000)));
        
        const decimales = await contract.decimals();
        const amount = ethers.parseUnits(cantidad.toString(), decimales);

        tx = await contract.transfer(direccionDestino, amount, {
          gasLimit: 60000,
          gasPrice: gasPrice
        });
      }

      const updated = await TransaccionBlockchain.markWithdrawalAsSent(
        withdrawal.id,
        tx.hash,
        estimatedFee
      );

      console.log(`✅ [BSC] Retiro enviado: ${cantidad} ${criptomoneda.symbol} - TX: ${tx.hash}`);
      return updated;

    } catch (txError) {
      throw new Error(`Error enviando transacción BSC: ${txError.message}`);
    }
  }

  async updateConfirmations() {
    try {
      // Buscar en ambas variantes de red para compatibilidad
      const redesToBuscar = this.isTestnet ? ['bsc', 'bsc-testnet'] : ['bsc', 'bsc-mainnet'];
      console.log(`🔄 [BSC] Buscando confirmaciones en redes: ${redesToBuscar.join(', ')}`);
      
      const pendingTxs = await TransaccionBlockchain.findAll({
        where: {
          estado: ['pendiente', 'procesando'],
          txHash: { [require('sequelize').Op.ne]: null }
        },
        include: [
          {
            model: Criptomoneda,
            as: 'criptomoneda',
            where: { red: redesToBuscar }
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
            
            console.log(`🔄 [BSC] TX ${tx.txHash}: ${confirmations} confirmaciones (requiere ${tx.confirmacionesRequeridas})`);
            
            if (confirmations !== tx.confirmaciones) {
              const updatedTx = await TransaccionBlockchain.updateConfirmations(
                tx.id,
                confirmations,
                tx.txHash
              );
              updated.push(updatedTx);
              
              console.log(`✅ [BSC] Confirmaciones actualizadas ${tx.txHash}: ${confirmations}`);
              
              // Si es un depósito que se acaba de confirmar, el balance debería actualizarse automáticamente
              if (tx.tipo === 'deposito' && confirmations >= tx.confirmacionesRequeridas && tx.confirmaciones < tx.confirmacionesRequeridas) {
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

  async getWalletBalance(criptomoneda) {
    if (criptomoneda.direccionContrato) {
      const contract = new ethers.Contract(
        criptomoneda.direccionContrato,
        [
          'function balanceOf(address) view returns (uint256)', 
          'function decimals() view returns (uint8)'
        ],
        this.provider
      );
      
      const balance = await contract.balanceOf(this.wallet.address);
      const decimales = await contract.decimals();
      return parseFloat(ethers.formatUnits(balance, decimales));
    } else {
      const balance = await this.provider.getBalance(this.wallet.address);
      return parseFloat(ethers.formatEther(balance));
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