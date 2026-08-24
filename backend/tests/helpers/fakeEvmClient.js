const EvmChainClient = require('../../services/blockchain/evmChainClient');

// Test double: canned native balance + send result, records send calls.
class FakeEvmClient extends EvmChainClient {
  constructor({ nativeBalance = '10', txHash = '0xdeadbeef', fee = '0.00042' } = {}) {
    super();
    this.nativeBalance = nativeBalance;
    this._txHash = txHash;
    this._fee = fee;
    this.sendCalls = [];
  }
  async getNativeBalance() { return this.nativeBalance; }
  async sendNativeTransfer(toAddress, amount) {
    this.sendCalls.push({ toAddress, amount });
    return { txHash: this._txHash, fee: this._fee };
  }
}

module.exports = FakeEvmClient;
