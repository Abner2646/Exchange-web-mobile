// services/blockchain/bitcoin.service.js - IMPLEMENTACIÓN FUNCIONAL BÁSICA
class BitcoinService {
  constructor() {
    this.network = 'bitcoin';
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://blockstream.info/api'
      : 'https://blockstream.info/testnet/api';
    this.requiredConfirmations = parseInt(process.env.BTC_REQUIRED_CONFIRMATIONS) || 6;
    
    console.log(`Bitcoin Service inicializado - Red: ${process.env.NODE_ENV === 'production' ? 'mainnet' : 'testnet'}`);
  }

  async scanForDeposits() {
    try {
      console.log('Escaneando Bitcoin testnet para depósitos...');
      
      const direcciones = await this.getActiveUserAddresses();
      const newDeposits = [];

      for (const direccion of direcciones) {
        try {
          const deposits = await this.scanBitcoinAddress(direccion);
          newDeposits.push(...deposits);
        } catch (error) {
          console.error(`Error escaneando BTC ${direccion.direccion}:`, error.message);
        }
      }

      return newDeposits;
    } catch (error) {
      console.error('Error en Bitcoin scan:', error.message);
      return [];
    }
  }

  async scanBitcoinAddress(direccion) {
    const url = `${this.baseUrl}/address/${direccion.direccion}/txs`;
    
    try {
      const response = await fetch(url);
      const transactions = await response.json();

      if (!Array.isArray(transactions)) {
        return [];
      }

      const deposits = [];
      
      for (const tx of transactions) {
        // Buscar outputs hacia esta dirección
        for (const vout of tx.vout) {
          if (vout.scriptpubkey_address === direccion.direccion) {
            
            // Verificar que no existe en DB
            const existing = await TransaccionBlockchain.findOne({
              where: { txHash: tx.txid }
            });

            if (!existing) {
              const amount = vout.value / 100000000; // Satoshis a BTC
              const fee = (tx.fee || 0) / 100000000;

              const newDeposit = await this.createBitcoinDeposit(
                direccion, amount, fee, tx.txid, tx.status.confirmed
              );

              deposits.push(newDeposit);
              console.log(`✅ Depósito BTC: ${amount} BTC (fee: ${fee} BTC) - TX: ${tx.txid}`);
            }
          }
        }
      }

      return deposits;
    } catch (error) {
      console.error(`Error Blockstream API para ${direccion.direccion}:`, error.message);
      return [];
    }
  }

  async createBitcoinDeposit(direccion, amount, fee, txid, confirmed) {
    const netAmount = Math.max(0, parseFloat(amount) - parseFloat(fee));
    
    return await TransaccionBlockchain.createDeposit({
      userId: direccion.userId,
      criptomonedaId: direccion.criptomonedaId,
      cantidad: netAmount,
      direccionDestino: direccion.direccion,
      direccionOrigen: null,
      txHash: txid,
      feeBlockchain: parseFloat(fee),
      confirmaciones: confirmed ? this.requiredConfirmations : 0,
      confirmacionesRequeridas: this.requiredConfirmations
    });
  }

  async getActiveUserAddresses() {
    return await DireccionDeposito.findAll({
      where: { activa: true },
      include: [
        {
          model: Criptomoneda,
          as: 'criptomoneda',
          where: { red: 'bitcoin', activa: true }
        }
      ]
    });
  }

  async processPendingWithdrawals() {
    console.log('Bitcoin withdrawals no implementados completamente aún');
    // Implementación básica pendiente - requiere librerías Bitcoin específicas
    return [];
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
            where: { red: 'bitcoin' }
          }
        ]
      });

      const updated = [];

      for (const tx of pendingTxs) {
        try {
          const url = `${this.baseUrl}/tx/${tx.txHash}`;
          const response = await fetch(url);
          const txData = await response.json();

          if (txData.status && txData.status.confirmed) {
            const confirmations = txData.status.block_height ? 
              await this.getCurrentBlockHeight() - txData.status.block_height : 0;

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
          console.error(`Error actualizando confirmaciones BTC para ${tx.txHash}:`, error.message);
        }
      }

      return updated;
    } catch (error) {
      console.error('Error actualizando confirmaciones Bitcoin:', error.message);
      return [];
    }
  }

  async getCurrentBlockHeight() {
    try {
      const response = await fetch(`${this.baseUrl}/blocks/tip/height`);
      return await response.json();
    } catch (error) {
      return 0;
    }
  }

  async validateAddress(address) {
    // Validación básica Bitcoin
    const btcRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/;
    return btcRegex.test(address);
  }
}

module.exports = BitcoinService;