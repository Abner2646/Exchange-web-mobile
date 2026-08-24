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
}

module.exports = EthersEvmClient;
