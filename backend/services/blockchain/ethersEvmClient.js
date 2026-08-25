require('dotenv').config();
const { ethers } = require('ethers');
const EvmChainClient = require('./evmChainClient');

// Real adapter: wraps the ethers provider + wallet. Holds the exact native
// logic previously inline in EthereumService.
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

class EthersEvmClient extends EvmChainClient {
  constructor({ rpcUrl, privateKey, provider, wallet, fallbackGwei = '20' }) {
    super();
    this.provider = provider || new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = wallet || new ethers.Wallet(privateKey, this.provider);
    // Last-resort gas price floor when the network reports none (rare). Kept
    // per-chain for parity (ETH used 20 gwei, BSC used 5 gwei).
    this.fallbackGwei = fallbackGwei;
  }

  async _gasPrice() {
    const feeData = await this.provider.getFeeData();
    return feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits(this.fallbackGwei, 'gwei');
  }

  async getNativeBalance() {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  async sendNativeTransfer(toAddress, amount) {
    const gasPrice = await this._gasPrice();
    const tx = await this.wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amount.toString()),
      gasLimit: 21000,
      gasPrice,
    });
    const fee = ethers.formatEther(gasPrice * BigInt(21000));
    return { txHash: tx.hash, fee };
  }

  async getTokenBalance(contractAddress) {
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, this.provider);
    const [balance, decimales] = await Promise.all([
      contract.balanceOf(this.wallet.address),
      contract.decimals(),
    ]);
    return ethers.formatUnits(balance, decimales);
  }

  async sendTokenTransfer(contractAddress, toAddress, amount) {
    const gasPrice = await this._gasPrice();
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, this.wallet);
    const decimales = await contract.decimals();
    const value = ethers.parseUnits(amount.toString(), decimales);
    const tx = await contract.transfer(toAddress, value, { gasLimit: 60000, gasPrice });
    const fee = ethers.formatEther(gasPrice * BigInt(60000));
    return { txHash: tx.hash, fee };
  }

  // Two-phase send. The split mirrors what wallet.sendTransaction does
  // internally (populate → sign → broadcast); it just captures the deterministic
  // hash before broadcasting so it can be persisted first (anti stuck-claim).
  // NOTE: not exercised by the test harness (fake only) — verify on a testnet
  // smoke-test before prod.
  async signNativeTransfer(toAddress, amount) {
    const gasPrice = await this._gasPrice();
    const populated = await this.wallet.populateTransaction({
      to: toAddress, value: ethers.parseEther(amount.toString()), gasLimit: 21000, gasPrice,
    });
    const signed = await this.wallet.signTransaction(populated);
    const txHash = ethers.Transaction.from(signed).hash;
    const fee = ethers.formatEther(gasPrice * BigInt(21000));
    return { txHash, signed, fee };
  }

  async signTokenTransfer(contractAddress, toAddress, amount) {
    const gasPrice = await this._gasPrice();
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, this.wallet);
    const decimales = await contract.decimals();
    const value = ethers.parseUnits(amount.toString(), decimales);
    const req = await contract.transfer.populateTransaction(toAddress, value, { gasLimit: 60000, gasPrice });
    const populated = await this.wallet.populateTransaction(req);
    const signed = await this.wallet.signTransaction(populated);
    const txHash = ethers.Transaction.from(signed).hash;
    const fee = ethers.formatEther(gasPrice * BigInt(60000));
    return { txHash, signed, fee };
  }

  async broadcast(signed) {
    const resp = await this.provider.broadcastTransaction(signed);
    return { txHash: resp.hash };
  }

  // null when the node does not know the tx at all (absent); 0 when in mempool
  // (present, unconfirmed); >0 when mined.
  async getConfirmations(txHash) {
    const tx = await this.provider.getTransaction(txHash);
    if (!tx) return null;
    if (tx.blockNumber == null) return 0;
    const latest = await this.provider.getBlockNumber();
    return Math.max(0, latest - tx.blockNumber + 1);
  }
}

module.exports = EthersEvmClient;
