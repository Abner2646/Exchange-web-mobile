
export type SwapType = 'buy' | 'sell';
export type SwapCompartment = 'funding' | 'spot';

/** Raw item from GET /parExchange (DECIMAL fields are JSON strings). */
export interface SwapPairDTO {
  id: string;
  baseCryptoId: string;
  quoteCryptoId: string;
  currentPrice: string;
  feePercent: string;
  active: boolean;
  oraclePaused: boolean;
  oraclePauseReason?: string | null;
  volume24h?: string;
  changePercent24h?: string;
  lastUpdated?: string;
  baseCrypto?: { id: string; symbol: string; name: string; network: string } | null;
  quoteCrypto?: { id: string; symbol: string; name: string; network: string } | null;
}

/** Normalized pair the UI consumes (symbols flattened, never null). */
export interface SwapPair {
  id: string;
  baseCryptoId: string;
  quoteCryptoId: string;
  currentPrice: string;
  feePercent: string;
  active: boolean;
  oraclePaused: boolean;
  baseSymbol: string;
  quoteSymbol: string;
}

export interface QuoteRequest {
  pairId: string;
  baseAmount: string; // canonical decimal string
  type: SwapType;
}

export interface QuoteResponse {
  par: { id: string; base: string; quote: string; price: string; volume24h?: string; lastUpdated?: string };
  calculo: {
    baseAmount: string | number;
    quoteAmount: string;
    feePercent: string;
    feeAmount: string;
    impactoSlippage: number;
    finalAmount: string;
    direccion: SwapType;
    precioEfectivo: string;
  };
  advertencias: string[];
}

export interface CheckLimitResponse {
  canTransact: boolean;
  dailyVolume: number;
  limit: number;
  remainingLimit: number;
  requestedAmount: number;
}

export interface ExecuteSwapRequest {
  pairId: string;
  type: SwapType;
  baseAmount: string; // canonical decimal string
  compartimento: SwapCompartment;
}

export interface ExecuteSwapResponse {
  message: string;
  data: {
    id: string;
    pairId: string;
    type: SwapType;
    baseAmount: string;
    quoteAmount: string;
    price: string;
    feeAmount: string;
    feePercent: string;
    status: string;
    completedAt?: string;
    precioUsado: string;
    comisionCalculada: string;
    netAmount: string;
  };
}

export interface MySwap {
  id: string;
  pairId: string;
  type: SwapType;
  baseAmount: string;
  quoteAmount: string;
  price: string;
  feeAmount: string;
  status: string;
  completedAt?: string;
  createdAt?: string;
}
