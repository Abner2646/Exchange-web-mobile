// Port: the chain operations the withdrawal path needs. Adapters implement it
// (EthersEvmClient for prod, FakeEvmClient for tests). ethers lives only in the
// real adapter — the service never touches it for the native path.
class EvmChainClient {
  // Master wallet native balance, human units (e.g. "10.5"), as a string.
  async getNativeBalance() { throw new Error('EvmChainClient.getNativeBalance not implemented'); }

  // Send `amount` (human units, string) of native coin to `toAddress`.
  // Returns { txHash, fee } (fee in human units, string).
  async sendNativeTransfer(toAddress, amount) { throw new Error('EvmChainClient.sendNativeTransfer not implemented'); }
}

module.exports = EvmChainClient;
