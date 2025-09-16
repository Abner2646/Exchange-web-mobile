// services/blockchain/bitcoin.service.js
require('dotenv').config();
const bitcoin = require('bitcoinjs-lib');
const ECPair = require('ecpair');
const { TransaccionBlockchain, DireccionDeposito, Criptomoneda } = require('../../models');

// Configurar tiny-secp256k1 para ECPair
const tinysecp = require('tiny-secp256k1');
const ECPairFactory = ECPair.ECPairFactory(tinysecp);

class BitcoinService {
  constructor() {
    // Configurar red según environment
    this.networkName = process.env.BITCOIN_NETWORK || 'testnet3';
    this.network = this.networkName === 'mainnet' 
      ? bitcoin.networks.bitcoin 
      : bitcoin.networks.testnet;
    
    this.requiredConfirmations = parseInt(process.env.BTC_REQUIRED_CONFIRMATIONS) || 3;
    this.feePerByte = parseInt(process.env.BTC_FEE_PER_BYTE) || 10;
    
    // BlockCypher API URL basada en red
    this.baseUrl = this.networkName === 'mainnet'
      ? 'https://api.blockcypher.com/v1/btc/main'
      : 'https://api.blockcypher.com/v1/btc/test3';
    
    // Token opcional para más requests
    this.apiToken = process.env.BLOCKCYPHER_TOKEN ? `?token=${process.env.BLOCKCYPHER_TOKEN}` : '';
    
    console.log(`Bitcoin Service inicializado:`);
    console.log(`   - Red: ${this.networkName}`);
    console.log(`   - API: ${this.baseUrl}`);
    console.log(`   - Confirmaciones requeridas: ${this.requiredConfirmations}`);
    
    // Inicializar wallet maestra
    this.initializeMasterWallet();
  }

  initializeMasterWallet() {
    try {
      if (!process.env.BTC_PRIVATE_KEY) {
        console.warn('BTC_PRIVATE_KEY no configurada - retiros no disponibles');
        return;
      }

      // Crear par de claves desde WIF
      this.keyPair = ECPairFactory.fromWIF(process.env.BTC_PRIVATE_KEY, this.network);
      
      // Generar dirección SegWit nativa (bech32)
      const { address } = bitcoin.payments.p2wpkh({ 
        pubkey: this.keyPair.publicKey, 
        network: this.network 
      });
      
      this.walletAddress = address;
      
      console.log(`Bitcoin Master Wallet: ${this.walletAddress}`);
      console.log(`🔧 DEBUG - Dirección completa: ${this.walletAddress}`);
      console.log(`🔧 DEBUG - Verificar fondos en: https://blockstream.info/testnet/address/${this.walletAddress}`);
      console.log(`🔧 DEBUG - O usar BlockCypher: https://live.blockcypher.com/btc-testnet/address/${this.walletAddress}`);
      console.log(`Retiros habilitados para ${this.networkName}`);
      
      // Verificar balance inmediatamente después de inicializar
      setTimeout(async () => {
        try {
          const balance = await this.getWalletBalance();
          console.log(`🔧 DEBUG - Balance inicial wallet: ${balance} BTC`);
          
          const utxos = await this.getWalletUTXOs();
          console.log(`🔧 DEBUG - UTXOs disponibles: ${utxos.length}`);
          
          if (balance === 0 || utxos.length === 0) {
            console.warn(`⚠️ WALLET SIN FONDOS: Envía BTC testnet a ${this.walletAddress} para habilitar retiros`);
            console.warn(`⚠️ Faucets recomendados:`);
            console.warn(`   - https://coinfaucet.eu/en/btc-testnet/`);
            console.warn(`   - https://testnet-faucet.mempool.co/`);
          }
        } catch (error) {
          console.error('🔧 DEBUG - Error verificando balance inicial:', error.message);
        }
      }, 2000); // Esperar 2 segundos después de inicializar
      
    } catch (error) {
      console.error('Error inicializando Bitcoin wallet:', error.message);
      console.error('Verifica que BTC_PRIVATE_KEY esté en formato WIF correcto');
    }
  }

  // =================== DETECTAR DEPÓSITOS ===================
  
  async scanForDeposits() {
    try {
      console.log('BTC - Escaneando para depósitos...');
      
      const direcciones = await this.getActiveUserAddresses();
      console.log(`BTC - Direcciones activas encontradas: ${direcciones.length}`);
      
      const newDeposits = [];

      for (const direccion of direcciones) {
        try {
          const deposits = await this.scanBitcoinAddress(direccion);
          newDeposits.push(...deposits);
        } catch (error) {
          console.error(`BTC - Error escaneando ${direccion.direccion}:`, error.message);
        }
      }

      console.log(`BTC - Depósitos encontrados: ${newDeposits.length}`);
      return newDeposits;
    } catch (error) {
      console.error('BTC - Error en scan general:', error.message);
      return [];
    }
  }

  async scanBitcoinAddress(direccion) {
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
        // Buscar outputs hacia esta dirección
        for (let outputIndex = 0; outputIndex < tx.outputs.length; outputIndex++) {
          const output = tx.outputs[outputIndex];
          
          // Verificar si el output es para nuestra dirección
          if (output.addresses && 
              output.addresses.includes(direccion.direccion) && 
              output.value > 0) {
            
            // Verificar que no existe en DB
            const existing = await TransaccionBlockchain.findOne({
              where: { txHash: tx.hash }
            });

            if (!existing) {
              const amountBTC = output.value / 100000000; // Satoshis a BTC
              const confirmations = tx.confirmations || 0;

              const newDeposit = await this.createBitcoinDeposit(
                direccion, amountBTC, 0, tx.hash, confirmations
              );

              deposits.push(newDeposit);
              console.log(`Depósito BTC: ${amountBTC} BTC - TX: ${tx.hash}`);
            }
          }
        }
      }

      return deposits;
    } catch (error) {
      console.error(`BTC - Error API para ${direccion.direccion}:`, error.message);
      return [];
    }
  }

  // =================== PROCESAR RETIROS ===================
  
  async processPendingWithdrawals() {
    try {
      console.log('BTC - Buscando retiros pendientes...');

      //DEBUG
      console.log('🔧 BTC DEBUG - Consultando directamente la BD...');
      const allPendingWithdrawals = await TransaccionBlockchain.findAll({
        where: {
          tipo: 'retiro',
          estado: 'pendiente'
        }
      });
      console.log(`🔧 BTC DEBUG - Total retiros pendientes (todas las redes): ${allPendingWithdrawals.length}`);

      const bitcoinCriptos = await Criptomoneda.findAll({
        where: { red: 'bitcoin' }
      });
      console.log(`🔧 BTC DEBUG - Criptomonedas Bitcoin encontradas: ${bitcoinCriptos.length}`);
      bitcoinCriptos.forEach(crypto => {
        console.log(`   - ${crypto.symbol}: id=${crypto.id}, activa=${crypto.activa}`);
      });
      //Fin debug
      
      if (!this.keyPair) {
        console.warn('BTC - Wallet no inicializada, retiros no disponibles');
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
            where: { red: 'bitcoin' }
          }
        ]
      });

      console.log(`BTC - Encontrados ${pendingWithdrawals.length} retiros pendientes`);
      const processed = [];

      for (const withdrawal of pendingWithdrawals) {
        try {
          console.log(`Procesando retiro BTC ${withdrawal.id}: ${withdrawal.cantidad} BTC a ${withdrawal.direccionDestino}`);
          
          const result = await this.processWithdrawal(withdrawal);
          processed.push(result);
        } catch (error) {
          console.error(`Error procesando retiro BTC ${withdrawal.id}:`, error.message);
          console.error(`❌ BTC - Error procesando retiro ${withdrawal.id}:`, error.message);
          console.error(`❌ BTC - Stack trace completo:`, error.stack); // Agregar esta línea
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

    // 1. Verificar balance de wallet maestra
    const walletBalance = await this.getWalletBalance();
    console.log(`Balance wallet BTC: ${walletBalance} BTC`);
    
    if (walletBalance < parseFloat(cantidad)) {
      throw new Error(`Balance insuficiente en wallet maestra BTC: ${walletBalance} < ${cantidad}`);
    }

    // 2. Obtener UTXOs disponibles
    const utxos = await this.getWalletUTXOs();
    console.log(`UTXOs disponibles: ${utxos.length}`);
    
    if (utxos.length === 0) {
      throw new Error('No hay UTXOs disponibles en wallet maestra');
    }

    // 3. Construir transacción
    const { txHex, actualFee } = await this.buildTransaction(
      utxos, direccionDestino, amountSatoshis
    );

    console.log(`Transacción construida, fee: ${actualFee / 100000000} BTC`);

    // 4. Broadcast usando BlockCypher
    const txid = await this.broadcastTransaction(txHex);

    // 5. Actualizar transacción en DB
    const updated = await TransaccionBlockchain.markWithdrawalAsSent(
      withdrawal.id,
      txid,
      actualFee / 100000000 // Fee en BTC
    );

    console.log(`Retiro BTC enviado: ${cantidad} BTC a ${direccionDestino}`);
    console.log(`TX Hash: ${txid}, Fee: ${actualFee / 100000000} BTC`);

    return updated;
  }

async buildTransaction(utxos, toAddress, amountSatoshis) {
  const psbt = new bitcoin.Psbt({ network: this.network });
  
  let totalInput = 0;
  let selectedUTXOs = [];
  
  for (const utxo of utxos) {
    selectedUTXOs.push(utxo);
    totalInput += utxo.value;
    
    const estimatedFee = 250 * this.feePerByte;
    
    if (totalInput >= amountSatoshis + estimatedFee) {
      break;
    }
  }
  
  if (totalInput < amountSatoshis + (250 * this.feePerByte)) {
    throw new Error(`UTXOs insuficientes para cubrir monto + fee`);
  }

  for (const utxo of selectedUTXOs) {
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

  const txSize = this.estimateTransactionSize(selectedUTXOs.length, 2);
  const actualFee = txSize * this.feePerByte;
  const change = totalInput - amountSatoshis - actualFee;

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

  return { txHex, actualFee };
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
    const data = await response.json();
    
    // Combinar UTXOs confirmados y no confirmados
    const allUTXOs = [
      ...(data.txrefs || []),           
      ...(data.unconfirmed_txrefs || []) 
    ];
    
    console.log(`🔧 DEBUG - UTXOs totales encontrados: ${allUTXOs.length}`);
    console.log(`🔧 DEBUG - Confirmados: ${(data.txrefs || []).length}, No confirmados: ${(data.unconfirmed_txrefs || []).length}`);
    
    if (allUTXOs.length === 0) {
      return [];
    }
    
    // Procesar UTXOs
    const processedUTXOs = [];
    
    for (const utxo of allUTXOs) {
      if (!utxo.spent) {
        processedUTXOs.push({
          txid: utxo.tx_hash,
          vout: utxo.tx_output_n,
          value: utxo.value,
          scriptPubKey: utxo.script,
          confirmations: utxo.confirmations
        });
      }
    }
    
    console.log(`🔧 DEBUG - UTXOs procesados (no gastados): ${processedUTXOs.length}`);
    
    return processedUTXOs;
  } catch (error) {
    console.error('Error obteniendo UTXOs BTC:', error.message);
    return [];
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

  async getWalletBalance() {
    if (!this.walletAddress) {
      return 0;
    }
    
    const url = `${this.baseUrl}/addrs/${this.walletAddress}/balance${this.apiToken}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      // Usar final_balance en lugar de balance (incluye confirmados + no confirmados)
      const balance = data.final_balance / 100000000;  // Cambiar esta línea
      console.log(`Balance wallet: ${balance} BTC (${data.final_balance} satoshis)`);
      
      return balance;
    } catch (error) {
      console.error('Error obteniendo balance wallet BTC:', error.message);
      return 0;
    }
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

  // =================== ACTUALIZAR CONFIRMACIONES ===================
  
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
          const url = `${this.baseUrl}/txs/${tx.txHash}${this.apiToken}`;
          const response = await fetch(url);
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
              
              console.log(`Confirmaciones BTC actualizadas para ${tx.txHash}: ${confirmations}`);
            }
          }
        } catch (error) {
          console.error(`Error actualizando confirmaciones BTC para ${tx.txHash}:`, error.message);
        }
      }

      return updated;
    } catch (error) {
      throw new Error(`Error actualizando confirmaciones BTC: ${error.message}`);
    }
  }

  // =================== MÉTODOS AUXILIARES ===================

  async getActiveUserAddresses() {
    try {
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
    } catch (error) {
      console.error('Error obteniendo direcciones BTC:', error.message);
      return [];
    }
  }

  async createBitcoinDeposit(direccion, amount, fee, txid, confirmations) {
    const netAmount = Math.max(0, parseFloat(amount) - parseFloat(fee));
    
    return await TransaccionBlockchain.createDeposit({
      userId: direccion.userId,
      criptomonedaId: direccion.criptomonedaId,
      cantidad: netAmount,
      direccionDestino: direccion.direccion,
      direccionOrigen: null,
      txHash: txid,
      feeBlockchain: parseFloat(fee),
      confirmaciones: confirmations,
      confirmacionesRequeridas: this.requiredConfirmations
    });
  }

  estimateTransactionSize(inputCount, outputCount) {
    // Estimación para transacciones SegWit
    const baseSize = 10; // versión, locktime, etc.
    const inputSize = inputCount * 68; // Aproximado para inputs SegWit
    const outputSize = outputCount * 31; // Aproximado para outputs
    
    return baseSize + inputSize + outputSize;
  }

  async validateAddress(address) {
    try {
      // Validar usando bitcoinjs-lib
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
      
      // Balance en BTC
      return (data.balance / 100000000).toString();
    } catch (error) {
      throw new Error(`Error obteniendo balance BTC: ${error.message}`);
    }
  }
}

module.exports = BitcoinService;