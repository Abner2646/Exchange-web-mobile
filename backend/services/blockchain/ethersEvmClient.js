require('dotenv').config();
const { ethers } = require('ethers');
const EvmChainClient = require('./evmChainClient');

// Real adapter: wraps the ethers provider + wallet. Holds the exact native
// logic previously inline in EthereumService.
class EthersEvmClient extends EvmChainClient {
  constructor({ rpcUrl, privateKey, provider, wallet }) {
    super();
    this.provider = provider || new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = wallet || new ethers.Wallet(privateKey, this.provider);
  }

  async getNativeBalance() {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  async sendNativeTransfer(toAddress, amount) {
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || ethers.parseUnits('20', 'gwei');
    const tx = await this.wallet.sendTransaction({
      to: toAddress,
      value: ethers.parseEther(amount.toString()),
      gasLimit: 21000,
      gasPrice,
    });
    const fee = ethers.formatEther(gasPrice * BigInt(21000));
    return { txHash: tx.hash, fee };
  }
}

module.exports = EthersEvmClient;
