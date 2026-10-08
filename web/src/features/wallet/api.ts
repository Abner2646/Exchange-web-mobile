import { apiClient } from '@/shared/api';
import type {
  BalanceEntry,
  CompartmentTransferRequest,
  CompartmentTransferResponse,
  DepositAddressResponse,
  WithdrawRequest,
  WithdrawResponse,
  BlockchainTransaction,
  TransactionHistoryParams,
} from './types';

/** Backend envelope for the on-chain endpoints: { success, data, ... }. */
interface SuccessEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

function buildQuery(params?: TransactionHistoryParams): string {
  if (!params) return '';
  const q = new URLSearchParams();
  if (params.type) q.set('type', params.type);
  if (params.status) q.set('status', params.status);
  if (params.cryptoId) q.set('cryptoId', params.cryptoId);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const walletApi = {
  // Raw array response (no envelope).
  getBalances: () => apiClient.get<BalanceEntry[]>('/balances/my/balances'),

  transferCompartments: (data: CompartmentTransferRequest) =>
    apiClient.post<CompartmentTransferResponse>('/balances/my/transfer', data),

  getDepositAddress: (cryptoId: string) =>
    apiClient
      .get<SuccessEnvelope<DepositAddressResponse>>(`/transaccionBlockchain/deposit-address/${cryptoId}`)
      .then((r) => r.data),

  withdraw: (data: WithdrawRequest) =>
    apiClient
      .post<SuccessEnvelope<WithdrawResponse>>('/transaccionBlockchain/withdraw', data)
      .then((r) => r.data),

  getTransactions: (params?: TransactionHistoryParams) =>
    apiClient
      .get<SuccessEnvelope<BlockchainTransaction[]>>(`/transaccionBlockchain/my${buildQuery(params)}`)
      .then((r) => r.data),
};
