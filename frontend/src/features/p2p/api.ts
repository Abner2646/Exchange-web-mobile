import { apiClient } from '../../shared/api';
import type { CanonicalAmount } from '../../shared/money';

export interface PaymentMethod {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface P2POffer {
  id: string;
  userId: string;
  type: 'buy' | 'sell';
  cryptoId: string;
  minAmount: CanonicalAmount;
  maxAmount: CanonicalAmount;
  unitPrice: CanonicalAmount;
  fiatCurrency: string;
  direccionFiat?: string;
  additionalTerms?: string;
  active: boolean;
  paymentMethods: PaymentMethod[];
  created_at: string;
  updated_at: string;
}

export interface P2PResponse {
  data: P2POffer[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface P2POfferFilters {
  type?: 'buy' | 'sell';
  cryptoId?: string;
  fiatCurrency?: string;
}

export async function fetchOffers(filters?: P2POfferFilters): Promise<P2PResponse> {
  const params = new URLSearchParams();
  if (filters?.type) params.append('type', filters.type);
  if (filters?.cryptoId) params.append('cryptoId', filters.cryptoId);
  if (filters?.fiatCurrency) params.append('fiatCurrency', filters.fiatCurrency);

  const queryString = params.toString();
  const url = queryString ? `/ofertaP2P/activas?${queryString}` : '/ofertaP2P/activas';
  
  return apiClient.get<P2PResponse>(url);
}
