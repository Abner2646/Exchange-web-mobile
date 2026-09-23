import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from 'react-query';
import { fetchMyBalances, transferInternal, BalanceViewModel, TransferInternalPayload } from './api';

export const walletQueryKeys = {
  balances: ['wallet', 'balances'] as const,
};

export function useBalances(): UseQueryResult<BalanceViewModel[], unknown> {
  return useQuery(walletQueryKeys.balances, fetchMyBalances);
}

export function useInternalTransfer(): UseMutationResult<void, unknown, TransferInternalPayload> {
  const queryClient = useQueryClient();
  return useMutation(
    (payload: TransferInternalPayload) => transferInternal(payload),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(walletQueryKeys.balances);
      },
    }
  );
}
