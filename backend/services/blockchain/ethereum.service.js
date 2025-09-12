// services/blockchain/ethereum.service.js
require('dotenv').config();
const { ethers } = require('ethers');
const { TransaccionBlockchain, DireccionDeposito, Criptomoneda } = require('../../models');

class EthereumService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    this.wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, this.provider);
    this.network = 'ethereum';
    this.requiredConfirmations = parseInt(process.env.ETH_REQUIRED_CONFIRMATIONS) || 12;
    this.hasApiKey = !!process.env.ETHERSCAN_API_KEY;
    
    console.log(`Ethereum Service inicializado - API: ${this.hasApiKey ? 'Disponible' : 'No disponible'}`);
  }

  // MÉTODO PRINCIPAL: Detectar depósitos
  async scanForDeposits() {
    try {
      if (this.hasApiKey) {
        console.log('Usando Etherscan API para detectar depósitos');
        return await this.scanWithEtherscanAPI();
      } else {
        console.log('Usando método de balance para detectar depósitos');
        return await this.scanWithBalanceCheck();
      }
    } catch (error) {
      console.error('Error en método principal, intentando fallback:', error.message);
      
      // Fallback al método de balance si falla API
      if (this.hasApiKey) {
        console.log('API falló, usando método de balance como fallback');
        return await this.scanWithBalanceCheck();
      }
      
      throw error;
    }
  }

  // MÉTODO 1: Etherscan API (Más preciso)
  async scanWithEtherscanAPI() {
    const direcciones = await this.getActiveUserAddresses();
    const newDeposits = [];
    const lastProcessedBlock = this.getLastProcessedBlock();

    for (const direccion of direcciones) {
      try {
        let deposits = [];
        
        if (direccion.criptomoneda.symbol === 'ETH') {
          deposits = await this.scanETHTransactions(direccion, lastProcessedBlock);
        } else if (direccion.criptomoneda.direccionContrato) {
          deposits = await this.scanTokenTransactions(direccion, lastProcessedBlock);
        }
        
        newDeposits.push(...deposits);
      } catch (error) {
        console.error(`Error escaneando ${direccion.direccion}:`, error.message);
      }
    }

    // Actualizar último bloque procesado
    const currentBlock = await this.provider.getBlockNumber();
    this.updateLastProcessedBlock(currentBlock);

    return newDeposits;
  }

  async scanETHTransactions(direccion, fromBlock) {
    const apiUrl = this.getEtherscanApiUrl();
    const url = `${apiUrl}?module=account&action=txlist&address=${direccion.direccion}&startblock=${fromBlock}&endblock=latest&sort=asc&apikey=${process.env.ETHERSCAN_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== '1') {
        console.warn(`Etherscan API warning para ${direccion.direccion}: ${data.message}`);
        return [];
      }

      const deposits = [];
      
      for (const tx of data.result) {
        // Solo transacciones entrantes con valor mayor a 0
        if (tx.to && tx.to.toLowerCase() === direccion.direccion.toLowerCase() && 
            parseFloat(tx.value) > 0 && tx.isError === '0') {
          
          const existing = await TransaccionBlockchain.findOne({
            where: { txHash: tx.hash }
          });

          if (!existing) {
            const amount = ethers.formatEther(tx.value);
            const fee = this.calculateTransactionFee(tx);

            const newDeposit = await this.createDepositTransaction(
              direccion, amount, fee, tx.hash, tx.from, parseInt(tx.confirmations || 0)
            );

            deposits.push(newDeposit);
            console.log(`✅ Depósito ETH: ${amount} ETH (fee: ${fee} ETH) - TX: ${tx.hash}`);
          }
        }
      }

      return deposits;
    } catch (error) {
      console.error(`Error API ETH para ${direccion.direccion}:`, error.message);
      return [];
    }
  }

  async scanTokenTransactions(direccion, fromBlock) {
    const apiUrl = this.getEtherscanApiUrl();
    const url = `${apiUrl}?module=account&action=tokentx&contractaddress=${direccion.criptomoneda.direccionContrato}&address=${direccion.direccion}&startblock=${fromBlock}&endblock=latest&sort=asc&apikey=${process.env.ETHERSCAN_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== '1') {
        return []; // No hay transacciones
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
      console.error(`Error API Token para ${direccion.direccion}:`, error.message);
      return [];
    }
  }

  // MÉTODO 2: Balance Check (Fallback)
  async scanWithBalanceCheck() {
    const direcciones = await this.getActiveUserAddresses();
    const newDeposits = [];

    for (const direccion of direcciones) {
      try {
        const currentBalance = await this.getCurrentBalance(direccion);
        const lastKnownBalance = await this.getLastKnownBalance(direccion);
        const tolerance = 0.00000001; // Tolerancia para diferencias mínimas

        if (currentBalance > lastKnownBalance + tolerance) {
          const newAmount = currentBalance - lastKnownBalance;
          
          // Crear depósito simplificado
          const newDeposit = await this.createSimpleDeposit(direccion, newAmount);
          newDeposits.push(newDeposit);
          
          console.log(`✅ Depósito detectado por balance: ${newAmount} ${direccion.criptomoneda.symbol}`);
        }
      } catch (error) {
        console.error(`Error balance check para ${direccion.direccion}:`, error.message);
      }
    }

    return newDeposits;
  }

  // PROCESAR RETIROS
  async processPendingWithdrawals() {
    //const {TransaccionBlockchain} = require('../../models/index') //Elimino reimportación problemática
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
            where: { red: 'ethereum' }
          }
        ]
      });

      const processed = [];

      for (const withdrawal of pendingWithdrawals) {
        try {
          const result = await this.processWithdrawal(withdrawal);
          processed.push(result);
        } catch (error) {
          console.error(`Error procesando retiro ${withdrawal.id}:`, error.message);
          await TransaccionBlockchain.failWithdrawal(withdrawal.id, error.message);
        }
      }

      return processed;
    } catch (error) {
      throw new Error(`Error procesando retiros ETH: ${error.message}`);
    }
  }

  async processWithdrawal(withdrawal) {
    console.log(`🔧 DEBUG - Procesando retiro ${withdrawal.id}:`);
    console.log(`   - Cantidad: ${withdrawal.cantidad}`);
    console.log(`   - Destino: ${withdrawal.direccionDestino}`);
    console.log(`   - Crypto: ${withdrawal.criptomoneda.symbol}`);
    const { cantidad, direccionDestino, criptomoneda } = withdrawal;

    // Verificar balance de wallet maestra antes de enviar
    console.log(`🔧 DEBUG - Verificando balance wallet maestra...`);
    try {
      const walletBalance = await this.getWalletBalance(criptomoneda);
      console.log(`🔧 DEBUG - Balance wallet: ${walletBalance} ${criptomoneda.symbol}`);
      console.log(`🔧 DEBUG - Cantidad requerida: ${cantidad} ${criptomoneda.symbol}`);
      
      if (walletBalance < parseFloat(cantidad)) {
        throw new Error(`Balance insuficiente en wallet maestra: ${walletBalance} < ${cantidad}`);
      }
    } catch (error) {
      console.error(`🔧 DEBUG - Error verificando balance:`, error.message);
      throw error;
    }

    console.log(`🔧 DEBUG - Iniciando envío de transacción...`);

    // ✅ CAMBIO 1: Declarar variables ANTES del if para scope correcto
    let tx;
    let estimatedFee;

    // ✅ CAMBIO 2: Obtener feeData UNA VEZ antes de los condicionales
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');

    if (criptomoneda.symbol === 'ETH') {
      // Enviar ETH nativo
      estimatedFee = parseFloat(ethers.formatEther(gasPrice * BigInt(21000)));
      
      tx = await this.wallet.sendTransaction({
        to: direccionDestino,
        value: ethers.parseEther(cantidad.toString()),
        gasLimit: 21000,
        gasPrice: gasPrice
      });
    } else {
      // Enviar token ERC-20
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

    console.log(`✅ Retiro enviado: ${cantidad} ${criptomoneda.symbol} a ${direccionDestino}`);
    console.log(`   TX Hash: ${tx.hash}, Fee estimado: ${estimatedFee} ETH`);

  return updated;
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
            where: { red: 'ethereum' }
          }
        ]
      });

      const updated = [];
      const currentBlock = await this.provider.getBlockNumber();

      for (const tx of pendingTxs) {
        try {
          const receipt = await this.provider.getTransactionReceipt(tx.txHash);
          
          if (receipt && receipt.blockNumber) {
            const confirmations = currentBlock - receipt.blockNumber;
            
            if (confirmations !== tx.confirmaciones) {
              const updatedTx = await TransaccionBlockchain.updateConfirmations(
                tx.id,
                confirmations,
                tx.txHash
              );
              updated.push(updatedTx);
              
              console.log(`Confirmaciones actualizadas para ${tx.txHash}: ${confirmations}`);
            }
          }
        } catch (error) {
          console.error(`Error actualizando confirmaciones para ${tx.txHash}:`, error.message);
        }
      }

      return updated;
    } catch (error) {
      throw new Error(`Error actualizando confirmaciones ETH: ${error.message}`);
    }
  }

  // MÉTODOS AUXILIARES
  async getActiveUserAddresses() {
    return await DireccionDeposito.findAll({
      where: { activa: true },
      include: [
        {
          model: Criptomoneda,
          as: 'criptomoneda',
          where: { red: 'ethereum', activa: true }
        }
      ]
    });
  }

  async getCurrentBalance(direccion) {
    if (direccion.criptomoneda.direccionContrato) {
      // Token ERC-20
      const contract = new ethers.Contract(
        direccion.criptomoneda.direccionContrato,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        this.provider
      );
      
      const balance = await contract.balanceOf(direccion.direccion);
      const decimales = await contract.decimals();
      return parseFloat(ethers.formatUnits(balance, decimales));
    } else {
      // ETH nativo
      const balance = await this.provider.getBalance(direccion.direccion);
      return parseFloat(ethers.formatEther(balance));
    }
  }

  async getLastKnownBalance(direccion) {
    const depositos = await TransaccionBlockchain.sum('cantidad', {
      where: {
        userId: direccion.userId,
        criptomonedaId: direccion.criptomonedaId,
        tipo: 'deposito',
        estado: ['confirmado', 'completado']
      }
    }) || 0;

    return parseFloat(depositos);
  }

  async getWalletBalance(criptomoneda) {
    if (criptomoneda.direccionContrato) {
      // Token ERC-20
      const contract = new ethers.Contract(
        criptomoneda.direccionContrato,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        this.provider
      );
      
      const balance = await contract.balanceOf(this.wallet.address);
      const decimales = await contract.decimals();
      return parseFloat(ethers.formatUnits(balance, decimales));
    } else {
      // ETH nativo
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
    const txHash = `balance_${direccion.direccion}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return await TransaccionBlockchain.createDeposit({
      userId: direccion.userId,
      criptomonedaId: direccion.criptomonedaId,
      cantidad: parseFloat(amount),
      direccionDestino: direccion.direccion,
      direccionOrigen: null,
      txHash: txHash,
      feeBlockchain: 0,
      confirmaciones: this.requiredConfirmations
    });
  }

  calculateTransactionFee(tx) {
    try {
      const gasUsed = BigInt(tx.gasUsed || 21000);
      const gasPrice = BigInt(tx.gasPrice || 20000000000); // 20 gwei default
      return parseFloat(ethers.formatEther(gasUsed * gasPrice));
    } catch (error) {
      return 0.002; // Fee estimado por defecto
    }
  }

  getEtherscanApiUrl() {
    return process.env.NODE_ENV === 'production' 
      ? 'https://api.etherscan.io/api'
      : 'https://api-sepolia.etherscan.io/api';
  }

  getLastProcessedBlock() {
    return parseInt(process.env.LAST_PROCESSED_BLOCK_ETH) || 0;
  }

  updateLastProcessedBlock(blockNumber) {
    process.env.LAST_PROCESSED_BLOCK_ETH = blockNumber.toString();
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
      throw new Error(`Error obteniendo balance: ${error.message}`);
    }
  }
}

module.exports = EthereumService;