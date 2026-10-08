import type { CanonicalAmount } from '@/shared/money';

export type Compartment = 'funding' | 'spot';

export interface CryptoRef {
  id: string;
  symbol: string;
  name: string;
  network: string;
  decimals: number;
}

/** Shape of GET /balances/my/balances items (real backend keys, English). */
export interface BalanceEntry {
  userId: string;
  criptomonedaId: string;
  availableBalance: string; // funding.available + spot.available (format8)
  blockedBalance: string;
  pendingBalance: string; // Funding-only, DISPLAY-ONLY (never spendable)
  compartments: {
    funding: { available: string; blocked: string; pending: string };
    spot: { available: string; blocked: string };
  };
  crypto: CryptoRef | null;
}

export interface CompartmentTransferRequest {
  cryptoId: string;
  amount: string; // canonical decimal string
  from: Compartment;
  to: Compartment;
}

export interface CompartmentTransferResponse {
  message: string;
  data: { from: Compartment; to: Compartment };
}

export interface DepositAddressResponse {
  address: string;
  crypto: CryptoRef | Record<string, unknown>;
  qrCode: string;
  derivationIndex?: number;
  metadata: {
    createdAt?: string;
    network: string;
    confirmationsRequired: number;
  };
  mensaje: string;
}

export interface WithdrawRequest {
  cryptoId: string;
  amount: string;
  destinationAddress: string;
}

export type WalletTxType = 'deposit' | 'withdrawal';
export type WalletTxStatus = 'pending' | 'processing' | 'confirmed' | 'completed' | 'failed';

export interface BlockchainTransaction {
  id: string;
  userId: string;
  cryptoId: string;
  type: WalletTxType;
  amount: string;
  destinationAddress?: string;
  txHash?: string;
  confirmations: number;
  requiredConfirmations: number;
  status: WalletTxStatus;
  createdAt: string;
}

export type WithdrawResponse = BlockchainTransaction;

export interface TransactionHistoryParams {
  type?: WalletTxType;
  status?: WalletTxStatus;
  cryptoId?: string;
  limit?: number;
  offset?: number;
}

// Re-export for component call sites that build amounts.
export type { CanonicalAmount };
