import { useQuery, UseQueryResult } from 'react-query';
import { fetchMyBalances, BalanceViewModel } from './api';

export const walletQueryKeys = {
  balances: ['wallet', 'balances'] as const,
};

export function useBalances(): UseQueryResult<BalanceViewModel[], unknown> {
  return useQuery(walletQueryKeys.balances, fetchMyBalances);
}
