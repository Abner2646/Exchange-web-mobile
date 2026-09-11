// Port: the chain operations the withdrawal path needs. Adapters implement it
// (EthersEvmClient for prod, FakeEvmClient for tests). ethers lives only in the
// real adapter — the service never touches it for the native path.
class EvmChainClient {
  // Master wallet native balance, human units (e.g. "10.5"), as a string.
  async getNativeBalance() { throw new Error('EvmChainClient.getNativeBalance not implemented'); }

  // Send `amount` (human units, string) of native coin to `toAddress`.
  // Returns { txHash, fee } (fee in human units, string).
  async sendNativeTransfer(toAddress, amount) { throw new Error('EvmChainClient.sendNativeTransfer not implemented'); }

  // Master wallet balance of the ERC20/BEP20 token at `contractAddress`,
  // human units (using the token's own decimals), as a string.
  async getTokenBalance(contractAddress) { throw new Error('EvmChainClient.getTokenBalance not implemented'); }

  // Send `amount` (human units, string) of the token at `contractAddress` to
  // `toAddress`. Returns { txHash, fee } (fee in native human units, string).
  async sendTokenTransfer(contractAddress, toAddress, amount) { throw new Error('EvmChainClient.sendTokenTransfer not implemented'); }

  // Two-phase send (so the txHash can be persisted BEFORE broadcast — anti
  // stuck-claim). sign* build + sign the tx with NO network effect and return
  // the deterministic hash + an opaque signed payload; broadcast sends it.
  async signNativeTransfer(toAddress, amount) { throw new Error('EvmChainClient.signNativeTransfer not implemented'); }
  async signTokenTransfer(contractAddress, toAddress, amount) { throw new Error('EvmChainClient.signTokenTransfer not implemented'); }
  async broadcast(signed) { throw new Error('EvmChainClient.broadcast not implemented'); }

  // On-chain lookup for the reaper: confirmations, 0 if in-mempool/unconfirmed,
  // or null if the tx is unknown to the node (never broadcast / dropped).
  async getConfirmations(txHash) { throw new Error('EvmChainClient.getConfirmations not implemented'); }
}

module.exports = EvmChainClient;
