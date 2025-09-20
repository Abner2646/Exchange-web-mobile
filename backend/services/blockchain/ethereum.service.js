// services/blockchain/ethereum.service.js - VERSIÓN CORREGIDA SIN BALANCE CHECK
require('dotenv').config();
const { ethers } = require('ethers');
const { TransaccionBlockchain, DireccionDeposito, Criptomoneda, BlockchainState } = require('../../models');

class EthereumService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
    this.wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, this.provider);
    this.network = 'ethereum';
    this.requiredConfirmations = parseInt(process.env.ETH_REQUIRED_CONFIRMATIONS) || 12;
    this.hasApiKey = !!process.env.ETHERSCAN_API_KEY;
    
    console.log(`Ethereum Service inicializado - API: ${this.hasApiKey ? 'Disponible' : 'No disponible'}`);
    
    if (!this.hasApiKey) {
      console.error('❌ CRITICAL: ETHERSCAN_API_KEY faltante. Depósitos ETH NO FUNCIONARÁN.');
    }
  }

  // ✅ MÉTODO PRINCIPAL: SOLO API, NUNCA BALANCE CHECK
  async scanForDeposits() {
    try {
      console.log('🔍 [ETH] Iniciando escaneo de depósitos...');
      
      // ❌ CRÍTICO: Sin API key no se puede escanear Ethereum de forma confiable
      if (!this.hasApiKey || !process.env.ETHERSCAN_API_KEY) {
        console.error('❌ [ETH] API key faltante. NO SE PUEDE ESCANEAR ETH SIN API.');
        console.error('❌ [ETH] Balance check ELIMINADO por crear transacciones ficticias problemáticas.');
        return [];
      }
      
      return await this.scanWithEtherscanAPI();
      
    } catch (error) {
      console.error('❌ [ETH] Error en escaneo:', error.message);
      return [];
    }
  }

  // ✅ MÉTODO API ÚNICO Y CONFIABLE
  async scanWithEtherscanAPI() {
    try {
      const direcciones = await this.getActiveUserAddresses();
      if (direcciones.length === 0) {
        console.log('ℹ️ [ETH] No hay direcciones activas para escanear');
        return [];
      }

      console.log(`🔍 [ETH] Escaneando ${direcciones.length} direcciones...`);
      
      // ✅ Obtener último bloque desde DB con el nuevo modelo
      const lastProcessedBlock = await BlockchainState.getLastProcessedBlock(this.network);
      console.log(`🔍 [ETH] Escaneando desde bloque: ${lastProcessedBlock}`);

      const newDeposits = [];

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
          console.error(`❌ [ETH] Error escaneando ${direccion.direccion}:`, error.message);
        }
      }

      // ✅ Actualizar último bloque en DB
      if (newDeposits.length > 0 || lastProcessedBlock === 0) {
        try {
          const currentBlock = await this.provider.getBlockNumber();
          await BlockchainState.updateLastProcessedBlock(this.network, currentBlock);
          
          if (newDeposits.length > 0) {
            await BlockchainState.incrementDepositsFound(this.network, newDeposits.length);
          }
          
          console.log(`✅ [ETH] Último bloque actualizado: ${currentBlock}`);
        } catch (blockError) {
          console.error('⚠️ [ETH] Error actualizando último bloque:', blockError.message);
        }
      }

      console.log(`✅ [ETH] Escaneo completado: ${newDeposits.length} depósitos encontrados`);
      return newDeposits;

    } catch (error) {
      console.error('❌ [ETH] Error en scanWithEtherscanAPI:', error.message);
      return [];
    }
  }

  async scanETHTransactions(direccion, fromBlock) {
    const apiUrl = this.getEtherscanApiUrl();
    const url = `${apiUrl}?module=account&action=txlist&address=${direccion.direccion}&startblock=${fromBlock}&endblock=latest&sort=asc&apikey=${process.env.ETHERSCAN_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== '1') {
        if (data.message === 'No transactions found') {
          return [];
        }
        console.warn(`⚠️ [ETH] API warning para ${direccion.direccion}: ${data.message}`);
        return [];
      }

      const deposits = [];
      
      for (const tx of data.result) {
        // ✅ SOLO transacciones entrantes con valor > 0 y exitosas
        if (tx.to && tx.to.toLowerCase() === direccion.direccion.toLowerCase() && 
            parseFloat(tx.value) > 0 && tx.isError === '0') {
          
          // ✅ VERIFICAR que no existe en DB
          const existing = await TransaccionBlockchain.findOne({
            where: { txHash: tx.hash }
          });

          if (!existing) {
            const amount = ethers.formatEther(tx.value);
            const fee = this.calculateTransactionFee(tx);

            const newDeposit = await this.createDepositFromTransaction(
              direccion, tx, amount, fee
            );

            deposits.push(newDeposit);
            console.log(`✅ [ETH] Depósito ETH: ${amount} ETH - TX: ${tx.hash}`);
          }
        }
      }

      return deposits;
    } catch (error) {
      console.error(`❌ [ETH] Error API ETH para ${direccion.direccion}:`, error.message);
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

            const newDeposit = await this.createDepositFromTransaction(
              direccion, tx, amount, fee
            );

            deposits.push(newDeposit);
            console.log(`✅ [ETH] Depósito ${direccion.criptomoneda.symbol}: ${amount} - TX: ${tx.hash}`);
          }
        }
      }

      return deposits;
    } catch (error) {
      console.error(`❌ [ETH] Error API Token para ${direccion.direccion}:`, error.message);
      return [];
    }
  }

  // ✅ CREAR DEPÓSITO DESDE TRANSACCIÓN REAL (no ficticios)
  async createDepositFromTransaction(direccion, tx, amount, fee) {
    return await TransaccionBlockchain.createDeposit({
      userId: direccion.userId,
      criptomonedaId: direccion.criptomonedaId,
      cantidad: Math.max(0, parseFloat(amount) - parseFloat(fee)),
      direccionDestino: direccion.direccion,
      direccionOrigen: tx.from,
      txHash: tx.hash, // ✅ HASH REAL de blockchain
      feeBlockchain: parseFloat(fee),
      confirmaciones: parseInt(tx.confirmations || 0),
      confirmacionesRequeridas: this.requiredConfirmations,
      blockNumber: parseInt(tx.blockNumber || 0),
      timestamp: new Date(parseInt(tx.timeStamp) * 1000)
    });
  }

  // PROCESAR RETIROS (sin cambios)
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

    // Verificar balance de wallet maestra
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

  // ✅ ACTUALIZAR CONFIRMACIONES (sin balance check)
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

      for (const tx of pendingTxs) {
        try {
          // ✅ NO MÁS balance check ficticios - solo transacciones reales
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
              
              console.log(`✅ [ETH] Confirmaciones actualizadas ${tx.txHash}: ${confirmations}`);
            }
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

  // MÉTODOS AUXILIARES
  async getActiveUserAddresses() {
    try {
      const direcciones = await DireccionDeposito.findAll({
        where: { activa: true },
        include: [
          {
            model: Criptomoneda,
            as: 'criptomoneda',
            where: { 
              red: 'ethereum',
              activa: true 
            },
            attributes: ['id', 'symbol', 'nombre', 'red', 'direccionContrato', 'decimales']
          }
        ]
      });
      
      return direcciones;
    } catch (error) {
      console.error('❌ [ETH] Error obteniendo direcciones:', error.message);
      return [];
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

  calculateTransactionFee(tx) {
    try {
      const gasUsed = BigInt(tx.gasUsed || 21000);
      const gasPrice = BigInt(tx.gasPrice || 20000000000);
      return parseFloat(ethers.formatEther(gasUsed * gasPrice));
    } catch (error) {
      return 0.002;
    }
  }

  getEtherscanApiUrl() {
    return process.env.NODE_ENV === 'production' 
      ? 'https://api.etherscan.io/api'
      : 'https://api-sepolia.etherscan.io/api';
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