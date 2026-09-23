import { useQuery, useMutation, useQueryClient, UseQueryResult } from 'react-query';
import { fetchOffers, P2PResponse, P2POfferFilters } from './api';
import { ApiError } from '../../shared/api';

export const p2pQueryKeys = {
  offers: (filters: P2POfferFilters) => ['p2p', 'offers', filters] as const,
};

export function useOffers(filters: P2POfferFilters): UseQueryResult<P2PResponse, ApiError> {
  return useQuery<P2PResponse, ApiError>(
    p2pQueryKeys.offers(filters),
    () => fetchOffers(filters),
    {
      keepPreviousData: true,
    }
  );
}

import { P2PTransaction, startTrade, getTransaction, markPaymentSent, confirmReceipt, openDispute, cancelTrade } from './api';
import type { CanonicalAmount } from '../../shared/money';

export const p2pTxQueryKeys = {
  transaction: (id: string) => ['p2p', 'transaction', id] as const,
};

export function useTransaction(id: string): UseQueryResult<P2PTransaction, ApiError> {
  return useQuery<P2PTransaction, ApiError>(
    p2pTxQueryKeys.transaction(id),
    () => getTransaction(id),
    {
      enabled: !!id,
    }
  );
}

export function useStartTrade() {
  return useMutation<P2PTransaction, ApiError, { offerId: string, amount: CanonicalAmount, paymentMethodId?: string }>(
    ({ offerId, amount, paymentMethodId }) => startTrade(offerId, amount, paymentMethodId)
  );
}

export function useMarkPaymentSent() {
  const queryClient = useQueryClient();
  return useMutation<P2PTransaction, ApiError, string>(
    (id) => markPaymentSent(id),
    {
      onSuccess: (data, id) => {
        queryClient.invalidateQueries(p2pTxQueryKeys.transaction(id));
      }
    }
  );
}

export function useConfirmReceipt() {
  const queryClient = useQueryClient();
  return useMutation<P2PTransaction, ApiError, string>(
    (id) => confirmReceipt(id),
    {
      onSuccess: (data, id) => {
        queryClient.invalidateQueries(p2pTxQueryKeys.transaction(id));
      }
    }
  );
}

export function useOpenDispute() {
  const queryClient = useQueryClient();
  return useMutation<P2PTransaction, ApiError, string>(
    (id) => openDispute(id),
    {
      onSuccess: (data, id) => {
        queryClient.invalidateQueries(p2pTxQueryKeys.transaction(id));
      }
    }
  );
}

export function useCancelTrade() {
  const queryClient = useQueryClient();
  return useMutation<P2PTransaction, ApiError, string>(
    (id) => cancelTrade(id),
    {
      onSuccess: (data, id) => {
        queryClient.invalidateQueries(p2pTxQueryKeys.transaction(id));
      }
    }
  );
}
