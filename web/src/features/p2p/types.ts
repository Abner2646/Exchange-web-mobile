export type OfferType = 'buy' | 'sell';

export type TxStatus =
  | 'initiated'
  | 'payment_confirmed'
  | 'completed'
  | 'cancelled';

export interface PaymentMethod {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface CryptoRef {
  id: string;
  symbol: string;
  name: string;
}

export interface Offer {
  id: string;
  userId: string;
  type: OfferType;
  cryptoId: string;
  minAmount: string;
  maxAmount: string;
  unitPrice: string;
  fiatCurrency: string;
  additionalTerms: string | null;
  active: boolean;
  direccionFiat: string | null;
  paymentMethods: PaymentMethod[];
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  offerId: string;
  buyerId: string;
  sellerId: string;
  cryptoId: string;
  amount: string;
  unitPrice: string;
  fiatAmount: string;
  fiatCurrency: string;
  paymentMethodId: string;
  status: TxStatus;
  paymentConfirmedAt: string | null;
  completedAt: string | null;
  created_at: string;
  updated_at: string;
  crypto?: { id: string; symbol: string; name: string; iconUrl?: string };
  buyer?: { id: string; username: string; averageRating: number | null };
  seller?: { id: string; username: string; averageRating: number | null };
  esComprador?: boolean;
}

export interface CreateOfferRequest {
  type: OfferType;
  cryptoId: string;
  minAmount: string;
  maxAmount: string;
  unitPrice: string;
  fiatCurrency: string;
  additionalTerms?: string;
  metodosPagoIds: string[];
  direccionFiat?: string;
}

export interface AcceptOfferRequest {
  offerId: string;
  amount: string;
  paymentMethodId: string;
}

export interface MyTxResponse {
  transacciones: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface ListEnvelope<T> {
  data: T[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
