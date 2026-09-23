import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from 'react-query';
import { fetchReferralSummary, claimReferrals, ReferralSummary, ClaimReferralsResponse } from './api';
import { walletQueryKeys } from '../wallet/queries';

export const referralsQueryKeys = {
  summary: ['referrals', 'summary'] as const,
};

export function useReferralSummary(): UseQueryResult<ReferralSummary, unknown> {
  return useQuery(referralsQueryKeys.summary, fetchReferralSummary);
}

export function useClaimReferrals(): UseMutationResult<ClaimReferralsResponse, unknown, void, unknown> {
  const queryClient = useQueryClient();
  
  return useMutation(claimReferrals, {
    onSuccess: () => {
      queryClient.invalidateQueries(referralsQueryKeys.summary);
      queryClient.invalidateQueries(walletQueryKeys.balances);
    }
  });
}
