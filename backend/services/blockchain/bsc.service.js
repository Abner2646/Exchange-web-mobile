// services/blockchain/bsc.service.js - IMPLEMENTACIÓN COMPLETA
const { ethers } = require('ethers');
const { TransaccionBlockchain, DireccionDeposito, Criptomoneda } = require('../../models');

class BscService {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
    this.wallet = new ethers.Wallet(process.env.BNB_PRIVATE_KEY, this.provider);
    this.network = 'bsc';
    this.requiredConfirmations = parseInt(process.env.BSC_REQUIRED_CONFIRMATIONS) || 6;
    this.hasApiKey = !!process.env.BSCSCAN_API_KEY;
    
    //console.log(`BSC Service inicializado - API: ${this.hasApiKey ? 'Disponible' : 'No disponible'}`);
  }

  async scanForDeposits() {
    try {
      if (this.hasApiKey) {
        //console.log('Usando BSCScan API para detectar depósitos');
        return await this.scanWithBscScanAPI();
      } else {
        //console.log('Usando método de balance para detectar depósitos BSC');
        return await this.scanWithBalanceCheck();
      }
    } catch (error) {
      //console.error('Error en BSC scan, usando fallback:', error.message);
      return await this.scanWithBalanceCheck();
    }
  }

  // IMPLEMENTACIÓN COMPLETA BSCScan API
  async scanWithBscScanAPI() {
    const direcciones = await this.getActiveUserAddresses();
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
        //console.error(`Error escaneando BSC ${direccion.direccion}:`, error.message);
      }
    }

    // Actualizar último bloque procesado
    const currentBlock = await this.provider.getBlockNumber();
    this.updateLastProcessedBlock(currentBlock);

    return newDeposits;
  }

  async scanBNBTransactions(direccion, fromBlock) {
    const apiUrl = this.getBscScanApiUrl();
    const url = `${apiUrl}?module=account&action=txlist&address=${direccion.direccion}&startblock=${fromBlock}&endblock=latest&sort=asc&apikey=${process.env.BSCSCAN_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== '1') {
        //console.warn(`BSCScan API warning para ${direccion.direccion}: ${data.message}`);
        return [];
      }

      const deposits = [];
      
      for (const tx of data.result) {
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
            //console.log(`✅ Depósito BNB: ${amount} BNB (fee: ${fee} BNB) - TX: ${tx.hash}`);
          }
        }
      }

      return deposits;
    } catch (error) {
      //console.error(`Error BSCScan API para ${direccion.direccion}:`, error.message);
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
            //console.log(`✅ Depósito ${direccion.criptomoneda.symbol}: ${amount} - TX: ${tx.hash}`);
          }
        }
      }

      return deposits;
    } catch (error) {
      //console.error(`Error BSCScan Token API para ${direccion.direccion}:`, error.message);
      return [];
    }
  }

  // Métodos auxiliares BSC
  getBscScanApiUrl() {
    return process.env.NODE_ENV === 'production' 
      ? 'https://api.bscscan.com/api'
      : 'https://api-testnet.bscscan.com/api';
  }

  getLastProcessedBlock() {
    return parseInt(process.env.LAST_PROCESSED_BLOCK_BSC) || 0;
  }

  updateLastProcessedBlock(blockNumber) {
    process.env.LAST_PROCESSED_BLOCK_BSC = blockNumber.toString();
  }

  async getActiveUserAddresses() {
    return await DireccionDeposito.findAll({
      where: { activa: true },
      include: [
        {
          model: Criptomoneda,
          as: 'criptomoneda',
          where: { red: 'bsc', activa: true }
        }
      ]
    });
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

  calculateTransactionFee(tx) {
    try {
      const gasUsed = BigInt(tx.gasUsed || 21000);
      const gasPrice = BigInt(tx.gasPrice || 5000000000); // 5 gwei default BSC
      return parseFloat(ethers.formatEther(gasUsed * gasPrice));
    } catch (error) {
      return 0.001; // Fee estimado por defecto BSC
    }
  }

  // Resto de métodos (balance check, retiros, etc.) - ya implementados antes
  async scanWithBalanceCheck() {
    const direcciones = await this.getActiveUserAddresses();
    const newDeposits = [];

    for (const direccion of direcciones) {
      try {
        const currentBalance = await this.getCurrentBalance(direccion);
        const lastKnownBalance = await this.getLastKnownBalance(direccion);
        
        if (currentBalance > lastKnownBalance + 0.00000001) {
          const newAmount = currentBalance - lastKnownBalance;
          const newDeposit = await this.createSimpleDeposit(direccion, newAmount);
          newDeposits.push(newDeposit);
          
          //console.log(`✅ Depósito BSC detectado: ${newAmount} ${direccion.criptomoneda.symbol}`);
        }
      } catch (error) {
        //console.error(`Error BSC balance para ${direccion.direccion}:`, error.message);
      }
    }

    return newDeposits;
  }

  async getCurrentBalance(direccion) {
    if (direccion.criptomoneda.direccionContrato) {
      const contract = new ethers.Contract(
        direccion.criptomoneda.direccionContrato,
        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
        this.provider
      );
      
      const balance = await contract.balanceOf(direccion.direccion);
      const decimales = await contract.decimals();
      return parseFloat(ethers.formatUnits(balance, decimales));
    } else {
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

  async createSimpleDeposit(direccion, amount) {
    const txHash = `bsc_balance_${direccion.direccion}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
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
            where: { red: 'bsc' }
          }
        ]
      });

      const processed = [];

      for (const withdrawal of pendingWithdrawals) {
        try {
          const result = await this.processWithdrawal(withdrawal);
          processed.push(result);
        } catch (error) {
          //console.error(`Error procesando retiro BSC ${withdrawal.id}:`, error.message);
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

    let tx;
    let estimatedFee;

    if (criptomoneda.symbol === 'BNB') {
      const gasPrice = await this.provider.getGasPrice();
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
        ['function transfer(address to, uint256 amount) returns (bool)', 'function decimals() view returns (uint8)'],
        this.wallet
      );

      const gasPrice = await this.provider.getGasPrice();
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

    //console.log(`✅ Retiro BSC enviado: ${cantidad} ${criptomoneda.symbol} a ${direccionDestino}`);
    return updated;
  }

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
            }
          }
        } catch (error) {
          //console.error(`Error actualizando confirmaciones BSC para ${tx.txHash}:`, error.message);
        }
      }

      return updated;
    } catch (error) {
      throw new Error(`Error actualizando confirmaciones BSC: ${error.message}`);
    }
  }

  async validateAddress(address) {
    return ethers.isAddress(address);
  }
}

module.exports = BscService;