// services/blockchain/bitcoin.service.js - VERSIÓN CORREGIDA CON TU ESTRUCTURA
require('dotenv').config();
const bitcoin = require('bitcoinjs-lib');
const ECPair = require('ecpair');
const { TransaccionBlockchain, DireccionDeposito, Criptomoneda, BlockchainState } = require('../../models');

const tinysecp = require('tiny-secp256k1');
const ECPairFactory = ECPair.ECPairFactory(tinysecp);

class BitcoinService {
  constructor() {
    this.networkName = process.env.BITCOIN_NETWORK || 'testnet3';
    this.network = this.networkName === 'mainnet' 
      ? bitcoin.networks.bitcoin 
      : bitcoin.networks.testnet;
    
    this.requiredConfirmations = parseInt(process.env.BTC_REQUIRED_CONFIRMATIONS) || 3;
    this.feePerByte = parseInt(process.env.BTC_FEE_PER_BYTE) || 10;
    
    this.baseUrl = this.networkName === 'mainnet'
      ? 'https://api.blockcypher.com/v1/btc/main'
      : 'https://api.blockcypher.com/v1/btc/test3';
    
    this.apiToken = process.env.BLOCKCYPHER_TOKEN ? `?token=${process.env.BLOCKCYPHER_TOKEN}` : '';
    
    console.log(`Bitcoin Service inicializado - Red: ${this.networkName}`);
    this.initializeMasterWallet();
  }

  initializeMasterWallet() {
    try {
      if (!process.env.BTC_PRIVATE_KEY) {
        console.warn('BTC_PRIVATE_KEY no configurada - retiros no disponibles');
        return;
      }

      this.keyPair = ECPairFactory.fromWIF(process.env.BTC_PRIVATE_KEY, this.network);
      
      const { address } = bitcoin.payments.p2wpkh({ 
        pubkey: this.keyPair.publicKey, 
        network: this.network 
      });
      
      this.walletAddress = address;
      console.log(`Bitcoin Master Wallet: ${this.walletAddress}`);
      
    } catch (error) {
      console.error('Error inicializando Bitcoin wallet:', error.message);
    }
  }

  // ✅ ESCANEAR DEPÓSITOS CON TU ESTRUCTURA DE PERSISTENCIA
  async scanForDeposits() {
    try {
      console.log('🔍 [BTC] Iniciando escaneo de depósitos...');
      
      const direcciones = await this.getActiveUserAddresses();
      if (direcciones.length === 0) {
        console.log('ℹ️ [BTC] No hay direcciones activas para escanear');
        return [];
      }

      console.log(`🔍 [BTC] Escaneando ${direcciones.length} direcciones...`);
      
      // ✅ Obtener último bloque desde DB usando tu estructura
      const lastProcessedBlock = await BlockchainState.getLastProcessedBlock(this.networkName);
      console.log(`🔍 [BTC] Escaneando desde bloque: ${lastProcessedBlock}`);

      const newDeposits = [];

      for (const direccion of direcciones) {
        try {
          const deposits = await this.scanBitcoinAddress(direccion, lastProcessedBlock);
          newDeposits.push(...deposits);
        } catch (error) {
          console.error(`❌ [BTC] Error escaneando ${direccion.direccion}:`, error.message);
        }
      }

      // ✅ Actualizar último bloque en DB usando tu estructura
      if (newDeposits.length > 0) {
        try {
          // Para Bitcoin, usar el bloque más alto de las transacciones encontradas
          const maxBlockHeight = Math.max(...newDeposits
            .filter(d => d.blockHeight)
            .map(d => d.blockHeight)
          );
          
          if (maxBlockHeight > lastProcessedBlock) {
            await BlockchainState.updateLastProcessedBlock(this.networkName, maxBlockHeight);
            await BlockchainState.incrementDepositsFound(this.networkName, newDeposits.length);
          }
        } catch (blockError) {
          console.error('⚠️ [BTC] Error actualizando último bloque:', blockError.message);
        }
      }

      console.log(`✅ [BTC] Escaneo completado: ${newDeposits.length} depósitos encontrados`);
      return newDeposits;

    } catch (error) {
      console.error('❌ [BTC] Error en escaneo general:', error.message);
      return [];
    }
  }

  async scanBitcoinAddress(direccion, fromBlock = 0) {
    const url = `${this.baseUrl}/addrs/${direccion.direccion}/full${this.apiToken}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`BlockCypher API error: ${response.status}`);
      }
      
      const data = await response.json();

      if (!data.txs || data.txs.length === 0) {
        return [];
      }

      const deposits = [];
      
      for (const tx of data.txs) {
        // ✅ Filtrar por bloque si es necesario
        if (fromBlock > 0 && tx.block_height && tx.block_height <= fromBlock) {
          continue;
        }

        // Buscar outputs hacia esta dirección
        for (let outputIndex = 0; outputIndex < tx.outputs.length; outputIndex++) {
          const output = tx.outputs[outputIndex];
          
          if (output.addresses && 
              output.addresses.includes(direccion.direccion) && 
              output.value > 0) {
            
            // ✅ Verificar que no existe en DB
            const existing = await TransaccionBlockchain.findOne({
              where: { txHash: tx.hash }
            });

            if (!existing) {
              const amountBTC = output.value / 100000000;
              const confirmations = tx.confirmations || 0;

              const newDeposit = await this.createBitcoinDeposit(
                direccion, 
                amountBTC, 
                0, 
                tx.hash, 
                confirmations, 
                tx.confirmed || tx.received,
                tx.block_height
              );

              deposits.push({
                ...newDeposit,
                blockHeight: tx.block_height
              });
              
              console.log(`✅ [BTC] Depósito: ${amountBTC} BTC - TX: ${tx.hash} - Bloque: ${tx.block_height}`);
            }
          }
        }
      }

      return deposits;
    } catch (error) {
      console.error(`❌ [BTC] Error API para ${direccion.direccion}:`, error.message);
      return [];
    }
  }

  async createBitcoinDeposit(direccion, amount, fee, txid, confirmations, timestamp, blockHeight) {
    const netAmount = Math.max(0, parseFloat(amount) - parseFloat(fee));
    
    const depositData = {
      userId: direccion.userId,
      criptomonedaId: direccion.criptomonedaId,
      cantidad: netAmount,
      direccionDestino: direccion.direccion,
      direccionOrigen: null,
      txHash: txid,
      feeBlockchain: parseFloat(fee),
      confirmaciones: confirmations,
      confirmacionesRequeridas: this.requiredConfirmations
    };

    // ✅ Agregar timestamp si está disponible
    if (timestamp) {
      depositData.timestamp = new Date(timestamp);
    }

    const deposit = await TransaccionBlockchain.createDeposit(depositData);
    
    // ✅ Agregar información extra para tracking
    deposit.blockHeight = blockHeight;
    
    return deposit;
  }

  // ✅ PROCESAR RETIROS (mantenemos la lógica existente que funciona)
  async processPendingWithdrawals() {
    try {
      if (!this.keyPair) {
        console.warn('[BTC] Wallet no inicializada, retiros no disponibles');
        return [];
      }
      
      const pendingWithdrawals = await TransaccionBlockchain.findAll({
        where: {
          tipo: 'retiro',
          estado: 'pendiente'
        },
        include: [
          {
            model: Criptomoneda,
            as: 'criptomoneda',
            where: { red: this.networkName }
          }
        ]
      });

      const processed = [];

      for (const withdrawal of pendingWithdrawals) {
        try {
          const result = await this.processWithdrawal(withdrawal);
          processed.push(result);
        } catch (error) {
          console.error(`❌ [BTC] Error procesando retiro ${withdrawal.id}:`, error.message);
          await TransaccionBlockchain.failWithdrawal(withdrawal.id, error.message);
        }
      }

      return processed;
    } catch (error) {
      throw new Error(`Error procesando retiros BTC: ${error.message}`);
    }
  }

  async processWithdrawal(withdrawal) {
    const { cantidad, direccionDestino } = withdrawal;
    const amountSatoshis = Math.floor(parseFloat(cantidad) * 100000000);

    // Verificar balance
    const walletBalance = await this.getWalletBalance();
    if (walletBalance < parseFloat(cantidad)) {
      throw new Error(`Balance insuficiente en wallet maestra BTC: ${walletBalance} < ${cantidad}`);
    }

    // Obtener UTXOs
    const utxos = await this.getWalletUTXOs();
    if (utxos.length === 0) {
      throw new Error('No hay UTXOs disponibles en wallet maestra');
    }

    // Construir transacción
    const { txHex, actualFee } = await this.buildTransaction(
      utxos, direccionDestino, amountSatoshis
    );

    // Broadcast
    const txid = await this.broadcastTransaction(txHex);

    // Actualizar en DB
    const updated = await TransaccionBlockchain.markWithdrawalAsSent(
      withdrawal.id,
      txid,
      actualFee / 100000000
    );

    console.log(`✅ [BTC] Retiro enviado: ${cantidad} BTC - TX: ${txid}`);
    return updated;
  }

  // ✅ ACTUALIZAR CONFIRMACIONES
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
            where: { red: this.networkName }
          }
        ]
      });

      const updated = [];

      for (const tx of pendingTxs) {
        try {
          const url = `${this.baseUrl}/txs/${tx.txHash}${this.apiToken}`;
          const response = await fetch(url);
          
          if (!response.ok) {
            console.warn(`⚠️ [BTC] API warning para TX ${tx.txHash}: ${response.status}`);
            continue;
          }
          
          const txData = await response.json();

          if (txData.confirmations !== undefined) {
            const confirmations = txData.confirmations;

            if (confirmations !== tx.confirmaciones) {
              const updatedTx = await TransaccionBlockchain.updateConfirmations(
                tx.id,
                confirmations,
                tx.txHash
              );
              updated.push(updatedTx);
              
              console.log(`✅ [BTC] Confirmaciones actualizadas ${tx.txHash}: ${confirmations}`);
            }
          }
        } catch (error) {
          console.error(`❌ [BTC] Error actualizando confirmaciones ${tx.txHash}:`, error.message);
        }
      }

      return updated;
    } catch (error) {
      throw new Error(`Error actualizando confirmaciones BTC: ${error.message}`);
    }
  }

  // MÉTODOS AUXILIARES (mantenemos los existentes que funcionan)
  async getActiveUserAddresses() {
    try {
      return await DireccionDeposito.findAll({
        where: { activa: true },
        include: [
          {
            model: Criptomoneda,
            as: 'criptomoneda',
            where: { red: this.networkName, activa: true }
          }
        ]
      });
    } catch (error) {
      console.error('❌ [BTC] Error obteniendo direcciones:', error.message);
      return [];
    }
  }

  async getWalletBalance() {
    if (!this.walletAddress) {
      return 0;
    }
    
    const url = `${this.baseUrl}/addrs/${this.walletAddress}/balance${this.apiToken}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      const balance = data.final_balance / 100000000;
      return balance;
    } catch (error) {
      console.error('Error obteniendo balance wallet BTC:', error.message);
      return 0;
    }
  }

  async getWalletUTXOs() {
    if (!this.walletAddress) {
      return [];
    }
    
    let url = `${this.baseUrl}/addrs/${this.walletAddress}`;
    
    const params = ['unspentOnly=true', 'includeScript=true'];
    
    if (this.apiToken) {
      params.push(`token=${this.apiToken.replace('?token=', '')}`);
    }
    
    url += '?' + params.join('&');
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`BlockCypher API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data) {
        return [];
      }
      
      const allUTXOs = [
        ...(data.txrefs || []),           
        ...(data.unconfirmed_txrefs || []) 
      ];
      
      if (allUTXOs.length === 0) {
        return [];
      }
      
      const processedUTXOs = [];
      
      for (const utxo of allUTXOs) {
        if (!utxo.spent && utxo.value && utxo.value > 0) {
          let scriptPubKey = utxo.script;
          
          if (!scriptPubKey) {
            try {
              const txOutput = await this.getTransactionOutput(utxo.tx_hash, utxo.tx_output_n);
              scriptPubKey = txOutput.scriptPubKey;
            } catch (scriptError) {
              console.warn(`No se pudo obtener script para UTXO ${utxo.tx_hash}:${utxo.tx_output_n}`);
              continue;
            }
          }
          
          processedUTXOs.push({
            txid: utxo.tx_hash,
            vout: utxo.tx_output_n,
            value: utxo.value,
            scriptPubKey: scriptPubKey,
            confirmations: utxo.confirmations || 0
          });
        }
      }
      
      processedUTXOs.sort((a, b) => (b.confirmations || 0) - (a.confirmations || 0));
      
      return processedUTXOs;
    } catch (error) {
      console.error('Error obteniendo UTXOs BTC:', error.message);
      return [];
    }
  }

  async buildTransaction(utxos, toAddress, amountSatoshis) {
    const psbt = new bitcoin.Psbt({ network: this.network });
    
    let totalInput = 0;
    let selectedUTXOs = [];
    
    const sortedUTXOs = [...utxos].sort((a, b) => b.value - a.value);
    
    for (const utxo of sortedUTXOs) {
      selectedUTXOs.push(utxo);
      totalInput += utxo.value;
      
      const inputCount = selectedUTXOs.length;
      const outputCount = 2;
      const estimatedSize = this.estimateTransactionSize(inputCount, outputCount);
      const estimatedFee = estimatedSize * this.feePerByte;
      
      if (totalInput >= amountSatoshis + estimatedFee) {
        break;
      }
    }
    
    const finalTxSize = this.estimateTransactionSize(selectedUTXOs.length, 2);
    const finalFee = finalTxSize * this.feePerByte;
    
    if (totalInput < amountSatoshis + finalFee) {
      throw new Error(`UTXOs insuficientes: necesario ${amountSatoshis + finalFee}, disponible ${totalInput}`);
    }

    for (const utxo of selectedUTXOs) {
      if (!utxo.scriptPubKey) {
        throw new Error(`UTXO ${utxo.txid}:${utxo.vout} sin scriptPubKey`);
      }
      
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: Buffer.from(utxo.scriptPubKey, 'hex'),
          value: utxo.value,
        },
      });
    }

    psbt.addOutput({
      address: toAddress,
      value: amountSatoshis,
    });

    const change = totalInput - amountSatoshis - finalFee;
    
    if (change > 546) {
      psbt.addOutput({
        address: this.walletAddress,
        value: change,
      });
    }

    for (let i = 0; i < selectedUTXOs.length; i++) {
      psbt.signInput(i, this.keyPair);
    }

    psbt.finalizeAllInputs();
    const txHex = psbt.extractTransaction().toHex();

    return { txHex, actualFee: finalFee };
  }

  async broadcastTransaction(txHex) {
    const url = `${this.baseUrl}/txs/push${this.apiToken}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tx: txHex })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Broadcast failed: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      return result.tx.hash;
    } catch (error) {
      throw new Error(`Error broadcasting BTC transaction: ${error.message}`);
    }
  }

  async getTransactionOutput(txHash, outputIndex) {
    const url = `${this.baseUrl}/txs/${txHash}${this.apiToken}`;
    
    try {
      const response = await fetch(url);
      const txData = await response.json();
      
      const output = txData.outputs[outputIndex];
      return {
        scriptPubKey: output.script
      };
    } catch (error) {
      throw new Error(`Error obteniendo output de transacción: ${error.message}`);
    }
  }

  estimateTransactionSize(inputCount, outputCount) {
    const baseSize = 10;
    const inputSize = inputCount * 68;
    const outputSize = outputCount * 31;
    
    return baseSize + inputSize + outputSize;
  }

  async validateAddress(address) {
    try {
      bitcoin.address.toOutputScript(address, this.network);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getBalance(address) {
    try {
      const url = `${this.baseUrl}/addrs/${address}/balance${this.apiToken}`;
      const response = await fetch(url);
      const data = await response.json();
      
      return (data.balance / 100000000).toString();
    } catch (error) {
      throw new Error(`Error obteniendo balance BTC: ${error.message}`);
    }
  }
}

module.exports = BitcoinService;