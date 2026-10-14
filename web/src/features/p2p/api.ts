import { apiClient } from '@/shared/api';
import type {
  Offer,
  Transaction,
  PaymentMethod,
  CryptoRef,
  CreateOfferRequest,
  AcceptOfferRequest,
  MyTxResponse,
  ListEnvelope,
} from './types';

function unwrapList<T>(r: ListEnvelope<T> | T[]): T[] {
  return Array.isArray(r) ? r : (r?.data ?? []);
}

export const p2pApi = {
  // --- offers ---
  getActiveOffers: () =>
    apiClient.get<ListEnvelope<Offer> | Offer[]>('/ofertaP2P/activas').then(unwrapList),

  getOffers: (params?: { type?: string; cryptoId?: string; fiatCurrency?: string }) => {
    const qs =
      params
        ? '?' +
          new URLSearchParams(
            Object.entries(params).filter(([, v]) => v != null) as [string, string][],
          ).toString()
        : '';
    return apiClient.get<ListEnvelope<Offer> | Offer[]>(`/ofertaP2P${qs}`).then(unwrapList);
  },

  getOffer: (id: string) => apiClient.get<Offer>(`/ofertaP2P/${id}`),

  getMyOffers: () =>
    apiClient.get<ListEnvelope<Offer> | Offer[]>('/ofertaP2P/me/ofertas').then(unwrapList),

  createOffer: (req: CreateOfferRequest) => apiClient.post<Offer>('/ofertaP2P', req),

  toggleOffer: (id: string, active: boolean) =>
    apiClient.patch<Offer>(`/ofertaP2P/${id}/toggle`, { active }),

  deleteOffer: (id: string) => apiClient.delete<{ message: string }>(`/ofertaP2P/${id}`),

  // --- transactions (state machine) ---
  // Money POST: opens a transaction and locks the seller's funds. An idempotency key
  // tied to the submit intent is supplied by the mutation hook (go-live gate §B.2);
  // the shared client also auto-attaches one for this path (isMoneyEndpoint). The
  // AUTHORITATIVE dedup is backend-side (idempotency middleware on POST /transaccionP2P).
  acceptOffer: (req: AcceptOfferRequest, idempotencyKey?: string) =>
    apiClient
      .post<{ message: string; data: Transaction }>(
        '/transaccionP2P',
        {
          offerId: req.offerId,
          amount: req.amount, // STRING on the wire
          paymentMethodId: req.paymentMethodId,
        },
        { idempotencyKey },
      )
      .then((r) => r.data),

  getMyTransactions: () => apiClient.get<MyTxResponse>('/transaccionP2P/me/transacciones'),

  getTransaction: (id: string) => apiClient.get<Transaction>(`/transaccionP2P/${id}`),

  confirmPayment: (id: string) =>
    apiClient
      .patch<{ message: string; data: Transaction }>(`/transaccionP2P/${id}/confirm-payment`)
      .then((r) => r.data),

  completeTransaction: (id: string) =>
    apiClient
      .patch<{ message: string; data: Transaction }>(`/transaccionP2P/${id}/complete`)
      .then((r) => r.data),

  cancelTransaction: (id: string) =>
    apiClient
      .patch<{ message: string; data: Transaction }>(`/transaccionP2P/${id}/cancel`)
      .then((r) => r.data),

  // --- payment methods + crypto catalog ---
  getPaymentMethods: () => apiClient.get<PaymentMethod[]>('/metodoPago/status/active'),

  getCryptoCatalog: () => apiClient.get<CryptoRef[]>('/crypto'),
};
