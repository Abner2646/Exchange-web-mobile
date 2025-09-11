// utils/blockchain.utils.js
const crypto = require('crypto');

class BlockchainUtils {
  // Generar hash único para transacciones simuladas
  static generateTxHash(prefix = 'tx') {
    const randomBytes = crypto.randomBytes(16);
    const timestamp = Date.now().toString(16);
    return `${prefix}_${timestamp}_${randomBytes.toString('hex')}`;
  }

  // Validar formato de dirección según la red
  static validateAddress(address, network) {
    switch (network.toLowerCase()) {
      case 'bitcoin':
      case 'btc':
        return this.validateBitcoinAddress(address);
      case 'ethereum':
      case 'eth':
      case 'bsc':
        return this.validateEthereumAddress(address);
      default:
        return false;
    }
  }

  static validateBitcoinAddress(address) {
    const btcRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/;
    return btcRegex.test(address);
  }

  static validateEthereumAddress(address) {
    const ethRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethRegex.test(address);
  }

  // Convertir entre unidades (wei <-> ether, satoshi <-> btc)
  static convertUnits(amount, fromUnit, toUnit, decimals = 18) {
    const factor = Math.pow(10, decimals);
    
    if (fromUnit === 'base' && toUnit === 'main') {
      return parseFloat(amount) / factor;
    } else if (fromUnit === 'main' && toUnit === 'base') {
      return Math.floor(parseFloat(amount) * factor);
    }
    
    return amount;
  }

  // Calcular fee estimado
  static estimateFee(network, amount, gasPrice = null) {
    switch (network.toLowerCase()) {
      case 'ethereum':
      case 'eth':
        const ethGasLimit = 21000;
        const ethGasPrice = gasPrice || 20000000000; // 20 gwei
        return (ethGasLimit * ethGasPrice) / Math.pow(10, 18);
      
      case 'bsc':
        const bscGasLimit = 21000;
        const bscGasPrice = gasPrice || 10000000000; // 10 gwei
        return (bscGasLimit * bscGasPrice) / Math.pow(10, 18);
      
      case 'bitcoin':
      case 'btc':
        return 0.0001; // Fee fijo para simplificar
      
      default:
        return 0.001;
    }
  }

  // Generar QR data para depósitos
  static generateQRData(symbol, address, amount = null) {
    if (amount) {
      return `${symbol.toLowerCase()}:${address}?amount=${amount}`;
    }
    return `${symbol.toLowerCase()}:${address}`;
  }

  // Formatear cantidad según decimales de la criptomoneda
  static formatAmount(amount, decimals = 8) {
    const factor = Math.pow(10, decimals);
    return Math.floor(parseFloat(amount) * factor) / factor;
  }

  // Validar que una cantidad es válida
  static isValidAmount(amount, minAmount = 0.00000001, maxAmount = 999999999) {
    const num = parseFloat(amount);
    return !isNaN(num) && num >= minAmount && num <= maxAmount;
  }

  // Generar dirección única simulada (para testing)
  static generateTestAddress(network, index = 0) {
    const hash = crypto.createHash('sha256');
    hash.update(`${network}_${index}_${Date.now()}`);
    const hashResult = hash.digest('hex');
    
    switch (network.toLowerCase()) {
      case 'bitcoin':
      case 'btc':
        return '1' + hashResult.substring(0, 33);
      
      case 'ethereum':
      case 'eth':
      case 'bsc':
        return '0x' + hashResult.substring(0, 40);
      
      default:
        return hashResult.substring(0, 40);
    }
  }

  // Simular tiempo de confirmación
  static getEstimatedConfirmationTime(network, confirmations) {
    const times = {
      bitcoin: 10 * 60, // 10 minutos por bloque
      ethereum: 12, // 12 segundos por bloque
      bsc: 3 // 3 segundos por bloque
    };
    
    const blockTime = times[network.toLowerCase()] || 60;
    return confirmations * blockTime;
  }

  // Log de transacción para debugging
  static logTransaction(type, data) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${type.toUpperCase()}:`, JSON.stringify(data, null, 2));
  }
}

module.exports = BlockchainUtils;