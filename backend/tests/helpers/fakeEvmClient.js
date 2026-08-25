const EvmChainClient = require('../../services/blockchain/evmChainClient');

// Test double: canned native balance + send result, records send calls.
class FakeEvmClient extends EvmChainClient {
  constructor({ nativeBalance = '10', tokenBalance = '1000', txHash = '0xdeadbeef', fee = '0.00042', confirmations = 1 } = {}) {
    super();
    this.nativeBalance = nativeBalance;
    this.tokenBalance = tokenBalance;
    this._txHash = txHash;
    this._fee = fee;
    this._confirmations = confirmations; // may be null (absent) / 0 (mempool) / >0 (mined)
    this.sendCalls = [];
    this.sendTokenCalls = [];
    this.signCalls = [];
    this.broadcastCalls = [];
  }
  async getNativeBalance() { return this.nativeBalance; }
  async sendNativeTransfer(toAddress, amount) {
    this.sendCalls.push({ toAddress, amount });
    return { txHash: this._txHash, fee: this._fee };
  }
  async getTokenBalance(contractAddress) { return this.tokenBalance; }
  async sendTokenTransfer(contractAddress, toAddress, amount) {
    this.sendTokenCalls.push({ contractAddress, toAddress, amount });
    return { txHash: this._txHash, fee: this._fee };
  }
  async signNativeTransfer(toAddress, amount) {
    this.signCalls.push({ kind: 'native', toAddress, amount });
    return { txHash: this._txHash, signed: `signed:${this._txHash}`, fee: this._fee };
  }
  async signTokenTransfer(contractAddress, toAddress, amount) {
    this.signCalls.push({ kind: 'token', contractAddress, toAddress, amount });
    return { txHash: this._txHash, signed: `signed:${this._txHash}`, fee: this._fee };
  }
  async broadcast(signed) {
    this.broadcastCalls.push({ signed });
    return { txHash: this._txHash };
  }
  async getConfirmations(txHash) { return this._confirmations; }
}

module.exports = FakeEvmClient;
