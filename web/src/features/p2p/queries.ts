'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@/shared/api';
import { p2pApi } from './api';
import type {
  Offer,
  Transaction,
  PaymentMethod,
  CryptoRef,
  AcceptOfferRequest,
  CreateOfferRequest,
  MyTxResponse,
} from './types';
import { WALLET_BALANCES_KEY } from '@/features/wallet/queries';

export const P2P_OFFERS_KEY = ['p2p', 'offers'] as const;
export const P2P_OFFER_KEY = (id: string) => ['p2p', 'offer', id] as const;
export const P2P_MY_OFFERS_KEY = ['p2p', 'my-offers'] as const;
export const P2P_MY_TX_KEY = ['p2p', 'my-tx'] as const;
export const P2P_TX_KEY = (id: string) => ['p2p', 'tx', id] as const;
export const P2P_METHODS_KEY = ['p2p', 'methods'] as const;
export const P2P_CRYPTO_KEY = ['p2p', 'crypto'] as const;

export function useActiveOffers() {
  return useQuery<Offer[], ApiError>({
    queryKey: P2P_OFFERS_KEY,
    queryFn: () => p2pApi.getActiveOffers(),
    staleTime: 30_000,
  });
}

export function useOffer(id: string, enabled: boolean) {
  return useQuery<Offer, ApiError>({
    queryKey: P2P_OFFER_KEY(id),
    queryFn: () => p2pApi.getOffer(id),
    enabled,
    staleTime: 15_000,
  });
}

export function useMyOffers() {
  return useQuery<Offer[], ApiError>({
    queryKey: P2P_MY_OFFERS_KEY,
    queryFn: () => p2pApi.getMyOffers(),
    staleTime: 15_000,
  });
}

export function useMyTransactions() {
  return useQuery<MyTxResponse, ApiError>({
    queryKey: P2P_MY_TX_KEY,
    queryFn: () => p2pApi.getMyTransactions(),
    staleTime: 10_000,
  });
}

export function useTransaction(id: string, enabled: boolean) {
  return useQuery<Transaction, ApiError>({
    queryKey: P2P_TX_KEY(id),
    queryFn: () => p2pApi.getTransaction(id),
    enabled,
    staleTime: 5_000,
  });
}

export function usePaymentMethods() {
  return useQuery<PaymentMethod[], ApiError>({
    queryKey: P2P_METHODS_KEY,
    queryFn: () => p2pApi.getPaymentMethods(),
    staleTime: 300_000,
  });
}

export function useCryptoCatalog() {
  return useQuery<CryptoRef[], ApiError>({
    queryKey: P2P_CRYPTO_KEY,
    queryFn: () => p2pApi.getCryptoCatalog(),
    staleTime: 300_000,
  });
}

function useTxMutation<V>(fn: (v: V) => Promise<Transaction>) {
  const qc = useQueryClient();
  return useMutation<Transaction, ApiError, V>({
    mutationFn: fn,
    onSuccess: (tx) => {
      qc.invalidateQueries({ queryKey: P2P_MY_TX_KEY });
      qc.invalidateQueries({ queryKey: WALLET_BALANCES_KEY });
      if (tx?.id) qc.invalidateQueries({ queryKey: P2P_TX_KEY(tx.id) });
    },
  });
}

export function useAcceptOffer() {
  return useTxMutation((req: AcceptOfferRequest) => p2pApi.acceptOffer(req));
}

export function useConfirmPayment() {
  return useTxMutation((id: string) => p2pApi.confirmPayment(id));
}

export function useCompleteTransaction() {
  return useTxMutation((id: string) => p2pApi.completeTransaction(id));
}

export function useCancelTransaction() {
  return useTxMutation((id: string) => p2pApi.cancelTransaction(id));
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation<Offer, ApiError, CreateOfferRequest>({
    mutationFn: (req) => p2pApi.createOffer(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: P2P_MY_OFFERS_KEY });
      qc.invalidateQueries({ queryKey: P2P_OFFERS_KEY });
    },
  });
}

export function useToggleOffer() {
  const qc = useQueryClient();
  return useMutation<Offer, ApiError, { id: string; active: boolean }>({
    mutationFn: ({ id, active }) => p2pApi.toggleOffer(id, active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: P2P_MY_OFFERS_KEY });
      qc.invalidateQueries({ queryKey: P2P_OFFERS_KEY });
    },
  });
}

export function useDeleteOffer() {
  const qc = useQueryClient();
  return useMutation<{ message: string }, ApiError, string>({
    mutationFn: (id) => p2pApi.deleteOffer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: P2P_MY_OFFERS_KEY });
      qc.invalidateQueries({ queryKey: P2P_OFFERS_KEY });
    },
  });
}
