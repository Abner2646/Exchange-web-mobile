// services/blockchain/bsc.service.js - IMPLEMENTACIÓN COMPLETA CORREGIDA
require('dotenv').config();
const { ethers } = require('ethers');
const { TransaccionBlockchain, DireccionDeposito, Criptomoneda } = require('../../models');

class BscService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
    this.wallet = new ethers.Wallet(process.env.BNB_PRIVATE_KEY, this.provider);
    this.network = 'bsc';
    this.requiredConfirmations = parseInt(process.env.BSC_REQUIRED_CONFIRMATIONS) || 6;
    this.hasApiKey = !!process.env.BSCSCAN_API_KEY;
    
    console.log(`BSC Service inicializado - API: ${this.hasApiKey ? 'Disponible' : 'No disponible'}`);
  }

  // MÉTODO PRINCIPAL: Detectar depósitos
  async scanForDeposits() {
      try {
        console.log('🔧 BSC DEBUG - Iniciando escaneo de depósitos...');
        
        // ✅ STRATEGY 1: Intentar con API primero
        if (this.hasApiKey && process.env.BSCSCAN_API_KEY) {
          console.log('🔧 BSC DEBUG - Usando BSCScan API');
          try {
            const apiResult = await this.scanWithBscScanAPI();
            if (apiResult && apiResult.length > 0) {
              return apiResult;
            }
            console.log('🔧 BSC DEBUG - API no devolvió resultados, probando balance check');
          } catch (apiError) {
            console.warn('🔧 BSC DEBUG - API falló, probando balance check:', apiError.message);
          }
        } else {
          console.log('🔧 BSC DEBUG - No hay API key, usando balance check directamente');
        }
        
        // ✅ STRATEGY 2: Fallback a balance check
        console.log('🔧 BSC DEBUG - Usando balance check como fallback');
        return await this.scanWithBalanceCheck();
        
      } catch (error) {
        console.error('🔧 BSC DEBUG - Error en ambos métodos:', error.message);
        return [];
      }
    }

  // MÉTODO 1: BSCScan API (Más preciso)
  async scanWithBscScanAPI() {
      try {
        // ✅ IMPORTANTE: Llamar getActiveUserAddresses correctamente
        const direcciones = await this.getActiveUserAddresses();
        console.log(`🔧 BSC DEBUG - Direcciones obtenidas: ${direcciones.length}`);
        
        if (direcciones.length === 0) {
          console.log('🔧 BSC DEBUG - No hay direcciones activas para BSC');
          return [];
        }
        
        const newDeposits = [];
        const lastProcessedBlock = this.getLastProcessedBlock();

        for (const direccion of direcciones) {
          try {
            let deposits = [];
            
            if (direccion.criptomoneda.symbol === 'BNB') {
              deposits = await this.scanBNBTransactions(direccion, lastProcessedBlock);
            } else if (direccion.criptomoneda.direccionContrato) {
              deposits = await this.scanBEP20Transactions(direccion, lastProcessedBlock);
            }
            
            newDeposits.push(...deposits);
          } catch (error) {
            console.error(`🔧 BSC DEBUG - Error escaneando ${direccion.direccion}:`, error.message);
          }
        }

        // Actualizar último bloque procesado
        try {
          const currentBlock = await this.provider.getBlockNumber();
          this.updateLastProcessedBlock(currentBlock);
        } catch (blockError) {
          console.warn('🔧 BSC DEBUG - Error actualizando último bloque:', blockError.message);
        }

        return newDeposits;
      } catch (error) {
        console.error('🔧 BSC DEBUG - Error en scanWithBscScanAPI:', error.message);
        throw error;
      }
    }

async scanBNBTransactions(direccion, fromBlock) {
    const apiUrl = this.getBscScanApiUrl();
    
    // ✅ CORRECCIÓN: URL con parámetros correctos
    let url = `${apiUrl}?module=account&action=txlist&address=${direccion.direccion}&startblock=${fromBlock}&endblock=latest&sort=asc`;
    
    if (process.env.BSCSCAN_API_KEY) {
      url += `&apikey=${process.env.BSCSCAN_API_KEY}`;
    }

    console.log(`🔧 BSC DEBUG - Escaneando BNB para ${direccion.direccion}`);
    console.log(`🔧 BSC DEBUG - URL: ${url.replace(process.env.BSCSCAN_API_KEY || '', 'HIDDEN')}`);

    try {
      const response = await fetch(url);
      const data = await response.json();

      console.log(`🔧 BSC DEBUG - Respuesta API:`, {
        status: data.status,
        message: data.message,
        resultCount: data.result ? data.result.length : 0
      });

      if (data.status !== '1') {
        console.warn(`🔧 BSC DEBUG - API warning: ${data.message}`);
        return [];
      }

      const deposits = [];
      
      for (const tx of data.result) {
        console.log(`🔧 BSC DEBUG - Procesando TX:`, {
          hash: tx.hash,
          to: tx.to,
          value: tx.value,
          isError: tx.isError,
          confirmations: tx.confirmations
        });

        // ✅ CORRECCIÓN: Verificación más robusta
        if (tx.to && 
            tx.to.toLowerCase() === direccion.direccion.toLowerCase() && 
            parseFloat(tx.value) > 0 && 
            tx.isError === '0') {
          
          const existing = await TransaccionBlockchain.findOne({
            where: { txHash: tx.hash }
          });

          if (!existing) {
            const amount = ethers.formatEther(tx.value);
            const fee = this.calculateTransactionFee(tx);

            console.log(`🔧 BSC DEBUG - Creando depósito BNB:`, {
              amount,
              fee,
              hash: tx.hash,
              from: tx.from
            });

            const newDeposit = await this.createDepositTransaction(
              direccion, amount, fee, tx.hash, tx.from, parseInt(tx.confirmations || 0)
            );

            deposits.push(newDeposit);
            console.log(`✅ BSC - Depósito BNB: ${amount} BNB - TX: ${tx.hash}`);
          } else {
            console.log(`🔧 BSC DEBUG - TX ya existe en DB: ${tx.hash}`);
          }
        }
      }

      return deposits;
    } catch (error) {
      console.error(`🔧 BSC DEBUG - Error API para ${direccion.direccion}:`, error.message);
      return [];
    }
  }

  async scanBEP20Transactions(direccion, fromBlock) {
    const apiUrl = this.getBscScanApiUrl();
    const url = `${apiUrl}?module=account&action=tokentx&contractaddress=${direccion.criptomoneda.direccionContrato}&address=${direccion.direccion}&startblock=${fromBlock}&endblock=latest&sort=asc&apikey=${process.env.BSCSCAN_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== '1') {
        return [];
      }

      const deposits = [];
      
      for (const tx of data.result) {
        if (tx.to && tx.to.toLowerCase() === direccion.direccion.toLowerCase()) {
          
          const existing = await TransaccionBlockchain.findOne({
            where: { txHash: tx.hash }
          });

          if (!existing) {
            const decimales = parseInt(tx.tokenDecimal);
            const amount = ethers.formatUnits(tx.value, decimales);
            const fee = this.calculateTransactionFee(tx);

            const newDeposit = await this.createDepositTransaction(
              direccion, amount, fee, tx.hash, tx.from, parseInt(tx.confirmations || 0)
            );

            deposits.push(newDeposit);
            console.log(`✅ Depósito ${direccion.criptomoneda.symbol}: ${amount} - TX: ${tx.hash}`);
          }
        }
      }

      return deposits;
    } catch (error) {
      console.error(`Error BSCScan Token API para ${direccion.direccion}:`, error.message);
      return [];
    }
  }

  // MÉTODO 2: Balance Check (Fallback)
  async scanWithBalanceCheck() {
      try {
        console.log('🔧 BSC DEBUG - Iniciando balance check...');
        
        // ✅ IMPORTANTE: Llamar getActiveUserAddresses correctamente
        const direcciones = await this.getActiveUserAddresses();
        console.log(`🔧 BSC DEBUG - Direcciones encontradas: ${direcciones.length}`);
        
        if (direcciones.length === 0) {
          console.log('🔧 BSC DEBUG - No hay direcciones activas para balance check');
          return [];
        }
        
        const newDeposits = [];

        for (const direccion of direcciones) {
          try {
            console.log(`🔧 BSC DEBUG - Verificando balance para ${direccion.direccion}`);
            
            const currentBalance = await this.getCurrentBalance(direccion);
            const lastKnownBalance = await this.getLastKnownBalance(direccion);
            const tolerance = 0.00000001;

            console.log(`🔧 BSC DEBUG - Balances:`, {
              direccion: direccion.direccion,
              crypto: direccion.criptomoneda.symbol,
              currentBalance,
              lastKnownBalance,
              difference: currentBalance - lastKnownBalance
            });

            if (currentBalance > lastKnownBalance + tolerance) {
              const newAmount = currentBalance - lastKnownBalance;
              
              console.log(`🔧 BSC DEBUG - Nuevo depósito detectado: ${newAmount}`);
              
              const newDeposit = await this.createSimpleDeposit(direccion, newAmount);
              newDeposits.push(newDeposit);
              
              console.log(`✅ BSC - Depósito detectado por balance: ${newAmount} ${direccion.criptomoneda.symbol}`);
            }
          } catch (error) {
            console.error(`🔧 BSC DEBUG - Error balance para ${direccion.direccion}:`, error.message);
          }
        }

        return newDeposits;
      } catch (error) {
        console.error('🔧 BSC DEBUG - Error en scanWithBalanceCheck:', error.message);
        throw error;
      }
    }

  // PROCESAR RETIROS
  async processPendingWithdrawals() {
    try {
      console.log('🔧 BSC - Buscando retiros pendientes...');
      
      const pendingWithdrawals = await TransaccionBlockchain.findAll({
        where: {
          tipo: 'retiro',
          estado: 'pendiente'
        },
        include: [
          {
            model: Criptomoneda,
            as: 'criptomoneda',
            where: { red: 'bsc' }
          }
        ]
      });

      console.log(`🔧 BSC - Encontrados ${pendingWithdrawals.length} retiros pendientes`);
      const processed = [];

      for (const withdrawal of pendingWithdrawals) {
        try {
          console.log(`🔧 BSC DEBUG - Procesando retiro ${withdrawal.id}:`);
          console.log(`   - Cantidad: ${withdrawal.cantidad}`);
          console.log(`   - Destino: ${withdrawal.direccionDestino}`);
          console.log(`   - Crypto: ${withdrawal.criptomoneda.symbol}`);
          
          const result = await this.processWithdrawal(withdrawal);
          processed.push(result);
        } catch (error) {
          console.error(`Error procesando retiro BSC ${withdrawal.id}:`, error.message);
          await TransaccionBlockchain.failWithdrawal(withdrawal.id, error.message);
        }
      }

      return processed;
    } catch (error) {
      throw new Error(`Error procesando retiros BSC: ${error.message}`);
    }
  }

  async processWithdrawal(withdrawal) {
    console.log(`🔧 BSC DEBUG - Verificando balance wallet maestra...`);
    const { cantidad, direccionDestino, criptomoneda } = withdrawal;

    // Verificar balance de wallet maestra antes de enviar
    const walletBalance = await this.getWalletBalance(criptomoneda);
    console.log(`🔧 BSC DEBUG - Balance wallet: ${walletBalance} ${criptomoneda.symbol}`);
    console.log(`🔧 BSC DEBUG - Cantidad requerida: ${cantidad} ${criptomoneda.symbol}`);
    
    if (walletBalance < parseFloat(cantidad)) {
      throw new Error(`Balance insuficiente en wallet maestra BSC: ${walletBalance} < ${cantidad}`);
    }

    console.log(`🔧 BSC DEBUG - Iniciando envío de transacción...`);

    // ✅ CORRECCIÓN: Declarar variables en scope correcto
    let tx;
    let estimatedFee;

    // ✅ CORRECCIÓN: Usar getFeeData() para ethers.js v6
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('5', 'gwei');

    try {
      if (criptomoneda.symbol === 'BNB') {
        // Enviar BNB nativo
        estimatedFee = parseFloat(ethers.formatEther(gasPrice * BigInt(21000)));
        
        tx = await this.wallet.sendTransaction({
          to: direccionDestino,
          value: ethers.parseEther(cantidad.toString()),
          gasLimit: 21000,
          gasPrice: gasPrice
        });
      } else {
        // Enviar token BEP-20
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

      // Actualizar transacción con hash real
      const updated = await TransaccionBlockchain.markWithdrawalAsSent(
        withdrawal.id,
        tx.hash,
        estimatedFee
      );

      console.log(`✅ BSC - Retiro enviado: ${cantidad} ${criptomoneda.symbol} a ${direccionDestino}`);
      console.log(`   TX Hash: ${tx.hash}, Fee estimado: ${estimatedFee} BNB`);

      return updated;

    } catch (txError) {
      console.error(`❌ Error en transacción BSC:`, txError.message);
      throw new Error(`Error enviando transacción BSC: ${txError.message}`);
    }
  }

  // ACTUALIZAR CONFIRMACIONES
async updateConfirmations() {
  try {
    const pendingTxs = await TransaccionBlockchain.findAll({
      where: {
        estado: ['pendiente', 'procesando'],
        txHash: { [require('sequelize').Op.ne]: null }
      },
      include: [
        {
          model: Criptomoneda,
          as: 'criptomoneda',
          where: { red: 'bsc' }
        }
      ]
    });

    const updated = [];

    for (const tx of pendingTxs) {
      try {
        // ✅ CORRECCIÓN: Detectar transacciones de balance check
        if (tx.txHash.startsWith('bsc_balance_')) {
          console.log(`🔧 BSC DEBUG - Transacción de balance check detectada: ${tx.txHash}`);
          
          // Para balance check, marcar como confirmado automáticamente
          const updatedTx = await TransaccionBlockchain.updateConfirmations(
            tx.id,
            this.requiredConfirmations, // Confirmaciones completas
            tx.txHash
          );
          updated.push(updatedTx);
          
          console.log(`✅ BSC - Balance check confirmado automáticamente: ${tx.txHash}`);
          continue;
        }
        
        // Para transacciones reales, consultar la blockchain
        const receipt = await this.provider.getTransactionReceipt(tx.txHash);
        
        if (receipt && receipt.blockNumber) {
          const currentBlock = await this.provider.getBlockNumber();
          const confirmations = currentBlock - receipt.blockNumber;
          
          if (confirmations !== tx.confirmaciones) {
            const updatedTx = await TransaccionBlockchain.updateConfirmations(
              tx.id,
              confirmations,
              tx.txHash
            );
            updated.push(updatedTx);
            
            console.log(`✅ BSC - Confirmaciones actualizadas para ${tx.txHash}: ${confirmations}`);
          }
        }
      } catch (error) {
        console.error(`Error actualizando confirmaciones BSC para ${tx.txHash}:`, error.message);
        
        // ✅ CORRECCIÓN ADICIONAL: Si es balance check y falla, auto-confirmar
        if (tx.txHash.startsWith('bsc_balance_')) {
          try {
            const updatedTx = await TransaccionBlockchain.updateConfirmations(
              tx.id,
              this.requiredConfirmations,
              tx.txHash
            );
            updated.push(updatedTx);
            console.log(`✅ BSC - Balance check auto-confirmado después de error: ${tx.txHash}`);
          } catch (autoConfirmError) {
            console.error(`Error auto-confirmando balance check: ${autoConfirmError.message}`);
          }
        }
      }
    }

    return updated;
  } catch (error) {
    throw new Error(`Error actualizando confirmaciones BSC: ${error.message}`);
  }
}

  async getCurrentBalance(direccion) {
      try {
        if (!direccion || !direccion.direccion) {
          throw new Error('Dirección inválida proporcionada');
        }

        if (!direccion.criptomoneda) {
          throw new Error('Información de criptomoneda faltante');
        }

        if (direccion.criptomoneda.direccionContrato) {
          // Token BEP-20
          console.log(`🔧 BSC DEBUG - Balance token ${direccion.criptomoneda.symbol} en ${direccion.direccion}`);
          
          const contract = new ethers.Contract(
            direccion.criptomoneda.direccionContrato,
            [
              'function balanceOf(address) view returns (uint256)', 
              'function decimals() view returns (uint8)'
            ],
            this.provider
          );
          
          const balance = await contract.balanceOf(direccion.direccion);
          const decimales = await contract.decimals();
          const formattedBalance = parseFloat(ethers.formatUnits(balance, decimales));
          
          console.log(`🔧 BSC DEBUG - Balance token: ${formattedBalance} ${direccion.criptomoneda.symbol}`);
          return formattedBalance;
        } else {
          // BNB nativo
          console.log(`🔧 BSC DEBUG - Balance BNB nativo en ${direccion.direccion}`);
          
          const balance = await this.provider.getBalance(direccion.direccion);
          const formattedBalance = parseFloat(ethers.formatEther(balance));
          
          console.log(`🔧 BSC DEBUG - Balance BNB: ${formattedBalance} BNB`);
          return formattedBalance;
        }
      } catch (error) {
        console.error(`🔧 BSC DEBUG - Error obteniendo balance:`, error);
        return 0;
      }
    }

  async testConnection() {
    try {
      console.log('🔧 BSC DEBUG - Probando conexión...');
      
      const blockNumber = await this.provider.getBlockNumber();
      console.log(`🔧 BSC DEBUG - Último bloque: ${blockNumber}`);
      
      const network = await this.provider.getNetwork();
      console.log(`🔧 BSC DEBUG - Red conectada:`, {
        chainId: network.chainId,
        name: network.name
      });
      
      return {
        connected: true,
        blockNumber,
        chainId: network.chainId
      };
    } catch (error) {
      console.error('🔧 BSC DEBUG - Error de conexión:', error.message);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  async getLastKnownBalance(direccion) {
    try {
      const { TransaccionBlockchain } = require('../../models');
      
      const depositos = await TransaccionBlockchain.sum('cantidad', {
        where: {
          userId: direccion.userId,
          criptomonedaId: direccion.criptomonedaId,
          tipo: 'deposito',
          estado: ['confirmado', 'completado']
        }
      });

      return parseFloat(depositos || 0);
    } catch (error) {
      console.error('🔧 BSC DEBUG - Error obteniendo último balance conocido:', error.message);
      return 0;
    }
  }

  async getWalletBalance(criptomoneda) {
    if (criptomoneda.direccionContrato) {
      // Token BEP-20
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
      // BNB nativo
      const balance = await this.provider.getBalance(this.wallet.address);
      return parseFloat(ethers.formatEther(balance));
    }
  }

  async createDepositTransaction(direccion, amount, fee, txHash, fromAddress, confirmations) {
    const netAmount = Math.max(0, parseFloat(amount) - parseFloat(fee));
    
    return await TransaccionBlockchain.createDeposit({
      userId: direccion.userId,
      criptomonedaId: direccion.criptomonedaId,
      cantidad: netAmount,
      direccionDestino: direccion.direccion,
      direccionOrigen: fromAddress,
      txHash: txHash,
      feeBlockchain: parseFloat(fee),
      confirmaciones: confirmations,
      confirmacionesRequeridas: this.requiredConfirmations
    });
  }

  async createSimpleDeposit(direccion, amount) {
      const { TransaccionBlockchain } = require('../../models');
      
      const txHash = `bsc_balance_${direccion.direccion}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return await TransaccionBlockchain.createDeposit({
        userId: direccion.userId,
        criptomonedaId: direccion.criptomonedaId,
        cantidad: parseFloat(amount),
        direccionDestino: direccion.direccion,
        direccionOrigen: null,
        txHash: txHash,
        feeBlockchain: 0,
        confirmaciones: this.requiredConfirmations, // Confirmaciones completas inmediatamente
        confirmacionesRequeridas: this.requiredConfirmations
      });
    }

  calculateTransactionFee(tx) {
    try {
      const gasUsed = BigInt(tx.gasUsed || 21000);
      const gasPrice = BigInt(tx.gasPrice || 5000000000); // 5 gwei default BSC
      return parseFloat(ethers.formatEther(gasUsed * gasPrice));
    } catch (error) {
      return 0.001; // Fee estimado por defecto BSC
    }
  }

  getBscScanApiUrl() {
    // ✅ IMPORTANTE: Verificar que uses la URL correcta según tu red
    if (process.env.BSC_NETWORK === 'testnet' || process.env.NODE_ENV !== 'production') {
      return 'https://api-testnet.bscscan.com/api';
    } else {
      return 'https://api.bscscan.com/api';
    }
  }

  getLastProcessedBlock() {
    return parseInt(process.env.LAST_PROCESSED_BLOCK_BSC) || 0;
  }

  updateLastProcessedBlock(blockNumber) {
    process.env.LAST_PROCESSED_BLOCK_BSC = blockNumber.toString();
    // En producción, guardar en DB o archivo de configuración
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
          [
            'function balanceOf(address) view returns (uint256)', 
            'function decimals() view returns (uint8)'
          ], 
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

  async getActiveUserAddresses() {
    try {
      console.log('🔧 BSC DEBUG - Buscando direcciones activas...');
      
      const { DireccionDeposito, Criptomoneda } = require('../../models');
      
      const direcciones = await DireccionDeposito.findAll({
        where: { activa: true },
        include: [
          {
            model: Criptomoneda,
            as: 'criptomoneda',
            where: { 
              red: 'bsc',
              activa: true 
            },
            attributes: ['id', 'symbol', 'nombre', 'red', 'direccionContrato', 'decimales']
          }
        ]
      });
      
      console.log(`🔧 BSC DEBUG - Direcciones encontradas: ${direcciones.length}`);
      
      return direcciones;
    } catch (error) {
      console.error('🔧 BSC DEBUG - Error obteniendo direcciones BSC:', error.message);
      throw error;
    }
  }
}

module.exports = BscService;