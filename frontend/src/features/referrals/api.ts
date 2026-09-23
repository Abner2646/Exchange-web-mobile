import { apiClient } from '../../shared/api';
import type { CanonicalAmount } from '../../shared/money';

export interface InvitedUser {
  email: string;
  createdAt: string;
}

export interface ReferralSummary {
  pendingUsdt: CanonicalAmount;
  invitedCount: number;
  invited: InvitedUser[];
}

export interface ClaimReferralsResponse {
  amountClaimed: CanonicalAmount;
  asset: string;
}

export async function fetchReferralSummary(): Promise<ReferralSummary> {
  return apiClient.get<ReferralSummary>('/referrals/summary');
}

export async function claimReferrals(): Promise<ClaimReferralsResponse> {
  return apiClient.post<ClaimReferralsResponse>('/referrals/claim', {});
}
