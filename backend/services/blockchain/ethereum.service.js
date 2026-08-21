// services/blockchain/ethereum.service.js - ACTUALIZADO PARA ETHERSCAN API V2
require('dotenv').config();
const { ethers } = require('ethers');
const { TransaccionBlockchain, DireccionDeposito, Criptomoneda, BlockchainState } = require('../../models');

class EthereumService {
  constructor() {
    this.isTestnet = process.env.NODE_ENV !== 'production';
    
    this.provider = new ethers.JsonRpcProvider(
      this.isTestnet ? process.env.ETHEREUM_SEPOLIA_RPC_URL : process.env.ETHEREUM_RPC_URL
    );
    
    this.wallet = new ethers.Wallet(
      this.isTestnet ? process.env.ETH_SEPOLIA_PRIVATE_KEY : process.env.ETH_PRIVATE_KEY, 
      this.provider
    );
    
    this.network = 'ethereum';
    this.actualNetwork = this.isTestnet ? 'sepolia' : 'ethereum';
    this.chainId = this.isTestnet ? 11155111 : 1; // Sepolia : Mainnet
    this.requiredConfirmations = parseInt(process.env.ETH_REQUIRED_CONFIRMATIONS) || 12;
    this.hasApiKey = !!process.env.ETHERSCAN_API_KEY;
    
    console.log(`Ethereum Service inicializado - Red: ${this.actualNetwork} (chainId: ${this.chainId}) - API: ${this.hasApiKey ? 'Disponible' : 'No disponible'}`);
    
    if (!this.hasApiKey) {
      console.error('❌ CRITICAL: ETHERSCAN_API_KEY faltante. Ethereum NO FUNCIONARÁ.');
    }
  }

  // MÉTODO PRINCIPAL CON API V2
  async scanForDeposits() {
    try {
      console.log(`🔍 [ETH] =================== INICIANDO ESCANEO ETHEREUM ===================`);
      console.log(`🔍 [ETH] Red: ${this.actualNetwork} (chainId: ${this.chainId})`);
      console.log(`🔍 [ETH] API Key disponible: ${this.hasApiKey}`);
      
      if (!this.hasApiKey || !process.env.ETHERSCAN_API_KEY) {
        console.error('❌ [ETH] API key faltante. NO SE PUEDE ESCANEAR ETHEREUM SIN API.');
        return [];
      }
      
      return await this.scanWithEtherscanV2API();
      
    } catch (error) {
      console.error('❌ [ETH] Error en escaneo principal:', error.message);
      console.error('❌ [ETH] Stack trace:', error.stack);
      return [];
    }
  }

  async scanWithEtherscanV2API() {
    try {
      console.log(`🔍 [ETH] Obteniendo direcciones activas...`);
      const direcciones = await this.getActiveUserAddresses();
      
      console.log(`🔍 [ETH] Direcciones encontradas: ${direcciones.length}`);
      
      if (direcciones.length === 0) {
        console.log('ℹ️ [ETH] No hay direcciones activas para escanear');
        return [];
      }

      // Log de direcciones encontradas
      direcciones.forEach((dir, index) => {
        console.log(`🔍 [ETH] Dirección ${index + 1}: ${dir.direccion} (${dir.criptomoneda.symbol})`);
      });

      const lastProcessedBlock = await BlockchainState.getLastProcessedBlock(this.actualNetwork);
      console.log(`🔍 [ETH] Último bloque procesado: ${lastProcessedBlock}`);

      const newDeposits = [];

      for (let i = 0; i < direcciones.length; i++) {
        const direccion = direcciones[i];
        
        try {
          console.log(`🔍 [ETH] ================== ESCANEANDO DIRECCIÓN ${i + 1}/${direcciones.length} ==================`);
          console.log(`🔍 [ETH] Dirección: ${direccion.direccion}`);
          console.log(`🔍 [ETH] Criptomoneda: ${direccion.criptomoneda.symbol}`);
          console.log(`🔍 [ETH] Red en DB: ${direccion.criptomoneda.red}`);
          console.log(`🔍 [ETH] Es token (tiene contrato): ${!!direccion.criptomoneda.direccionContrato}`);
          
          let deposits = [];
          
          if (direccion.criptomoneda.symbol === 'ETH') {
            console.log(`🔍 [ETH] Escaneando transacciones ETH nativas...`);
            deposits = await this.scanETHTransactions(direccion, lastProcessedBlock);
          } else if (direccion.criptomoneda.direccionContrato) {
            console.log(`🔍 [ETH] Escaneando transacciones ERC20 (${direccion.criptomoneda.symbol})...`);
            console.log(`🔍 [ETH] Contrato: ${direccion.criptomoneda.direccionContrato}`);
            deposits = await this.scanTokenTransactions(direccion, lastProcessedBlock);
          } else {
            console.warn(`⚠️ [ETH] Tipo de criptomoneda no reconocido para ${direccion.criptomoneda.symbol}`);
          }
          
          console.log(`🔍 [ETH] Depósitos encontrados para esta dirección: ${deposits.length}`);
          newDeposits.push(...deposits);
          
          // Pausa entre direcciones para evitar rate limiting
          if (i < direcciones.length - 1) {
            console.log(`🔍 [ETH] Pausa de 500ms antes de la siguiente dirección...`);
            await this.sleep(500);
          }
          
        } catch (error) {
          console.error(`❌ [ETH] Error escaneando dirección ${direccion.direccion}:`, error.message);
          console.error(`❌ [ETH] Stack trace:`, error.stack);
        }
      }

      // Actualizar último bloque en DB
      if (newDeposits.length > 0 || lastProcessedBlock === 0) {
        try {
          console.log(`🔍 [ETH] Obteniendo bloque actual...`);
          const currentBlock = await this.provider.getBlockNumber();
          console.log(`🔍 [ETH] Bloque actual: ${currentBlock}`);
          
          await BlockchainState.updateLastProcessedBlock(this.actualNetwork, currentBlock);
          
          if (newDeposits.length > 0) {
            await BlockchainState.incrementDepositsFound(this.actualNetwork, newDeposits.length);
          }
          
          console.log(`✅ [ETH] Último bloque actualizado a: ${currentBlock}`);
        } catch (blockError) {
          console.error('⚠️ [ETH] Error actualizando último bloque:', blockError.message);
        }
      }

      console.log(`✅ [ETH] =================== ESCANEO ETHEREUM COMPLETADO ===================`);
      console.log(`✅ [ETH] Total depósitos encontrados: ${newDeposits.length}`);
      console.log(`✅ [ETH] Direcciones escaneadas: ${direcciones.length}`);
      
      return newDeposits;

    } catch (error) {
      console.error('❌ [ETH] Error en scanWithEtherscanV2API:', error.message);
      console.error('❌ [ETH] Stack trace:', error.stack);
      return [];
    }
  }

  async scanETHTransactions(direccion, fromBlock) {
    const url = this.buildTransactionListUrl(direccion.direccion, fromBlock);

    try {
      console.log(`🔍 [ETH-NATIVE] URL de API: ${url.replace(process.env.ETHERSCAN_API_KEY, '***')}`);
      console.log(`🔍 [ETH-NATIVE] Consultando API para ${direccion.direccion}...`);
      console.log(`🔍 [ETH-NATIVE] ChainId: ${this.chainId}, Rango de bloques: ${fromBlock} a latest`);
      
      const response = await fetch(url);
      console.log(`🔍 [ETH-NATIVE] Respuesta HTTP: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`🔍 [ETH-NATIVE] Respuesta API:`, {
        status: data.status,
        message: data.message,
        resultCount: data.result ? (Array.isArray(data.result) ? data.result.length : 'Not array') : 'N/A'
      });

      if (data.status !== '1') {
        if (data.message === 'No transactions found') {
          console.log(`ℹ️ [ETH-NATIVE] No hay transacciones ETH para ${direccion.direccion}`);
          return [];
        } else {
          console.warn(`⚠️ [ETH-NATIVE] API warning: ${data.message}`);
          return [];
        }
      }

      if (!data.result || !Array.isArray(data.result)) {
        console.warn(`⚠️ [ETH-NATIVE] Respuesta sin datos válidos`);
        return [];
      }

      const transactions = data.result;
      console.log(`🔍 [ETH-NATIVE] Procesando ${transactions.length} transacciones...`);

      const deposits = [];
      let incomingTransactions = 0;
      let validDeposits = 0;
      
      for (const tx of transactions) {
        console.log(`🔍 [ETH-NATIVE] TX ${tx.hash}:`);
        console.log(`  - From: ${tx.from}`);
        console.log(`  - To: ${tx.to}`);
        console.log(`  - Value: ${tx.value} wei (${ethers.formatEther(tx.value)} ETH)`);
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
            console.log(`ℹ️ [ETH-NATIVE] TX ${tx.hash} ya existe en DB, saltando...`);
            continue;
          }

          console.log(`✅ [ETH-NATIVE] TX ${tx.hash} es un depósito válido y nuevo!`);
          
          const amount = ethers.formatEther(tx.value);
          const fee = this.calculateTransactionFee(tx);

          console.log(`💰 [ETH-NATIVE] Creando depósito:`);
          console.log(`  - Usuario ID: ${direccion.userId}`);
          console.log(`  - Cantidad: ${amount} ETH`);
          console.log(`  - Fee: ${fee} ETH`);

          const newDeposit = await this.createDepositFromTransaction(
            direccion, tx, amount, fee
          );

          deposits.push(newDeposit);
          console.log(`✅ [ETH-NATIVE] Depósito creado exitosamente con ID: ${newDeposit.id}`);
        }
      }

      console.log(`📊 [ETH-NATIVE] Resumen para ${direccion.direccion}:`);
      console.log(`  - Total transacciones analizadas: ${transactions.length}`);
      console.log(`  - Transacciones entrantes: ${incomingTransactions}`);
      console.log(`  - Depósitos válidos: ${validDeposits}`);
      console.log(`  - Depósitos nuevos creados: ${deposits.length}`);

      return deposits;
    } catch (error) {
      console.error(`❌ [ETH-NATIVE] Error API para ${direccion.direccion}:`, error.message);
      console.error(`❌ [ETH-NATIVE] Stack trace:`, error.stack);
      return [];
    }
  }

  async scanTokenTransactions(direccion, fromBlock) {
    const url = this.buildTokenTransactionUrl(direccion.direccion, direccion.criptomoneda.direccionContrato, fromBlock);

    try {
      console.log(`🔍 [ETH-ERC20] URL de API: ${url.replace(process.env.ETHERSCAN_API_KEY, '***')}`);
      console.log(`🔍 [ETH-ERC20] Consultando API para token ${direccion.criptomoneda.symbol}...`);
      
      const response = await fetch(url);
      console.log(`🔍 [ETH-ERC20] Respuesta HTTP: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`🔍 [ETH-ERC20] Respuesta API:`, {
        status: data.status,
        message: data.message,
        resultCount: data.result ? (Array.isArray(data.result) ? data.result.length : 'Not array') : 'N/A'
      });

      if (data.status !== '1') {
        if (data.message === 'No transactions found') {
          console.log(`ℹ️ [ETH-ERC20] No hay transacciones ${direccion.criptomoneda.symbol} para ${direccion.direccion}`);
          return [];
        } else {
          console.warn(`⚠️ [ETH-ERC20] API warning: ${data.message}`);
          return [];
        }
      }

      if (!data.result || !Array.isArray(data.result)) {
        console.warn(`⚠️ [ETH-ERC20] Respuesta sin datos válidos`);
        return [];
      }

      const transactions = data.result;
      console.log(`🔍 [ETH-ERC20] Procesando ${transactions.length} transacciones ${direccion.criptomoneda.symbol}...`);

      const deposits = [];
      let incomingTransactions = 0;
      let validDeposits = 0;
      
      for (const tx of transactions) {
        console.log(`🔍 [ETH-ERC20] TX ${tx.hash}:`);
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
            console.log(`ℹ️ [ETH-ERC20] TX ${tx.hash} ya existe en DB, saltando...`);
            continue;
          }

          validDeposits++;
          console.log(`✅ [ETH-ERC20] TX ${tx.hash} es un depósito válido y nuevo!`);

          const fee = this.calculateTransactionFee(tx);

          console.log(`💰 [ETH-ERC20] Creando depósito ${direccion.criptomoneda.symbol}:`);
          console.log(`  - Usuario ID: ${direccion.userId}`);
          console.log(`  - Cantidad: ${amount} ${direccion.criptomoneda.symbol}`);
          console.log(`  - Fee: ${fee} ETH`);

          const newDeposit = await this.createDepositFromTransaction(
            direccion, tx, amount, fee
          );

          deposits.push(newDeposit);
          console.log(`✅ [ETH-ERC20] Depósito creado exitosamente con ID: ${newDeposit.id}`);
        }
      }

      console.log(`📊 [ETH-ERC20] Resumen para ${direccion.direccion} (${direccion.criptomoneda.symbol}):`);
      console.log(`  - Total transacciones analizadas: ${transactions.length}`);
      console.log(`  - Transacciones entrantes: ${incomingTransactions}`);
      console.log(`  - Depósitos válidos: ${validDeposits}`);
      console.log(`  - Depósitos nuevos creados: ${deposits.length}`);

      return deposits;
    } catch (error) {
      console.error(`❌ [ETH-ERC20] Error Token API para ${direccion.criptomoneda.symbol}:`, error.message);
      console.error(`❌ [ETH-ERC20] Stack trace:`, error.stack);
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
      console.log(`🔧 [ETH] Creando depósito en DB...`);
      
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
      
      console.log(`🔧 [ETH] Datos del depósito:`, depositData);
      
      const deposit = await TransaccionBlockchain.createDeposit(depositData);
      
      console.log(`✅ [ETH] Depósito creado en DB con ID: ${deposit.id}`);
      return deposit;
      
    } catch (error) {
      console.error(`❌ [ETH] Error creando depósito en DB:`, error.message);
      console.error(`❌ [ETH] Stack trace:`, error.stack);
      throw error;
    }
  }

  // MÉTODOS AUXILIARES
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getActiveUserAddresses() {
    try {
      console.log(`🔧 [ETH] Buscando direcciones activas...`);
      console.log(`🔧 [ETH] Red configurada: ${this.actualNetwork}`);
      
      const redesToBuscar = this.isTestnet ? ['sepolia', 'ethereum'] : ['ethereum', 'mainnet'];
      console.log(`🔧 [ETH] Redes a buscar: ${redesToBuscar.join(', ')}`);
      
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
      
      console.log(`🔧 [ETH] Direcciones encontradas: ${direcciones.length}`);
      
      if (direcciones.length > 0) {
        direcciones.forEach((dir, index) => {
          console.log(`🔧 [ETH] Dirección ${index + 1}:`);
          console.log(`  - Dirección: ${dir.direccion}`);
          console.log(`  - Criptomoneda: ${dir.criptomoneda.symbol}`);
          console.log(`  - Red en DB: ${dir.criptomoneda.red}`);
          console.log(`  - Usuario ID: ${dir.userId}`);
        });
      }
      
      return direcciones;
    } catch (error) {
      console.error('❌ [ETH] Error obteniendo direcciones:', error.message);
      console.error('❌ [ETH] Stack trace:', error.stack);
      return [];
    }
  }

  calculateTransactionFee(tx) {
    try {
      const gasUsed = BigInt(tx.gasUsed || 21000);
      const gasPrice = BigInt(tx.gasPrice || 20000000000);
      return parseFloat(ethers.formatEther(gasUsed * gasPrice));
    } catch (error) {
      return 0.002;
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
          console.error(`❌ [ETH] Error procesando retiro ${withdrawal.id}:`, error.message);
          await TransaccionBlockchain.failWithdrawal(withdrawal.id, error.message);
        }
      }

      return processed;
    } catch (error) {
      throw new Error(`Error procesando retiros ETH: ${error.message}`);
    }
  }

  async processWithdrawal(withdrawal) {
    const { cantidad, direccionDestino, criptomoneda } = withdrawal;

    const walletBalance = await this.getWalletBalance(criptomoneda);
    if (walletBalance < parseFloat(cantidad)) {
      throw new Error(`Balance insuficiente en wallet maestra ETH: ${walletBalance} < ${cantidad}`);
    }

    let tx;
    let estimatedFee;

    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');

    try {
      if (criptomoneda.symbol === 'ETH') {
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

      console.log(`✅ [ETH] Retiro enviado: ${cantidad} ${criptomoneda.symbol} - TX: ${tx.hash}`);
      return updated;

    } catch (txError) {
      throw new Error(`Error enviando transacción ETH: ${txError.message}`);
    }
  }

  async updateConfirmations() {
    try {
      // Buscar en ambas variantes de red para compatibilidad
      const redesToBuscar = this.isTestnet ? ['sepolia', 'ethereum'] : ['ethereum', 'mainnet'];
      console.log(`🔄 [ETH] Buscando confirmaciones en redes: ${redesToBuscar.join(', ')}`);
      
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

      console.log(`🔄 [ETH] Encontradas ${pendingTxs.length} transacciones pendientes para actualizar`);

      const updated = [];

      for (const tx of pendingTxs) {
        try {
          console.log(`🔄 [ETH] Actualizando confirmaciones para TX: ${tx.txHash}`);
          
          const receipt = await this.provider.getTransactionReceipt(tx.txHash);
          
          if (receipt && receipt.blockNumber) {
            const currentBlock = await this.provider.getBlockNumber();
            const confirmations = currentBlock - receipt.blockNumber;
            
            console.log(`🔄 [ETH] TX ${tx.txHash}: ${confirmations} confirmaciones (requiere ${tx.confirmacionesRequeridas})`);
            
            if (confirmations !== tx.confirmaciones) {
              const updatedTx = await TransaccionBlockchain.updateConfirmations(
                tx.id,
                confirmations,
                tx.txHash
              );
              updated.push(updatedTx);
              
              console.log(`✅ [ETH] Confirmaciones actualizadas ${tx.txHash}: ${confirmations}`);
              
              // Si es un depósito que se acaba de confirmar, el balance debería actualizarse automáticamente
              if (tx.tipo === 'deposito' && confirmations >= tx.confirmacionesRequeridas && tx.confirmaciones < tx.confirmacionesRequeridas) {
                console.log(`🎉 [ETH] Depósito confirmado! Balance del usuario debería actualizarse automáticamente`);
              }
            }
          } else {
            console.log(`⚠️ [ETH] No se pudo obtener receipt para TX: ${tx.txHash}`);
          }
        } catch (error) {
          console.error(`❌ [ETH] Error actualizando confirmaciones ${tx.txHash}:`, error.message);
        }
      }

      return updated;
    } catch (error) {
      throw new Error(`Error actualizando confirmaciones ETH: ${error.message}`);
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

module.exports = EthereumService;