export { walletApi } from './api';
export * from './types';
export {
  useMyBalances,
  useCompartmentTransfer,
  useDepositAddress,
  useWithdraw,
  useTransactionHistory,
  WALLET_BALANCES_KEY,
  WALLET_TX_KEY,
} from './queries';
export { default as WalletTabs } from './components/WalletTabs';
