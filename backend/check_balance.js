require('dotenv').config();
   const { ethers } = require('ethers');
   
   // Para verificar que las variables se cargan correctamente
   console.log('RPC URL cargado:', !!process.env.ETHEREUM_RPC_URL);
   console.log('Private Key cargado:', !!process.env.ETH_PRIVATE_KEY);
   console.log('Longitud de Private Key:', process.env.ETH_PRIVATE_KEY?.length);
   
   const provider = new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL);
   const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, provider);
   
   provider.getBalance(wallet.address).then(balance => {
     console.log(`Balance de wallet maestra: ${ethers.formatEther(balance)} ETH`);
     console.log(`Dirección: ${wallet.address}`);
   }).catch(error => {
     console.error('Error:', error.message);
   });