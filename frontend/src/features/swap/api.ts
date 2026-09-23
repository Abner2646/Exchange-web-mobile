import { apiClient } from '../../shared/api';
import type { CanonicalAmount } from '../../shared/money';

export interface CalculateSwapRequest {
  from: string;
  to: string;
  amount: CanonicalAmount;
  source: 'funding' | 'spot';
}

export interface CalculateSwapResponse {
  rate: CanonicalAmount;
  fee: CanonicalAmount;
  netAmount: CanonicalAmount;
}

export async function calculateSwap(params: CalculateSwapRequest): Promise<CalculateSwapResponse> {
  return apiClient.post<CalculateSwapResponse>('/intercambioExchange/calculate', params);
}

