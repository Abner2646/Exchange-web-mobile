import { apiClient } from '@/shared/api';
import type { SwapPair, SwapPairDTO, QuoteRequest, QuoteResponse, CheckLimitResponse } from './types';

function normalizePair(dto: SwapPairDTO): SwapPair | null {
  if (!dto.baseCrypto || !dto.quoteCrypto) return null; // can't trade a pair we can't label
  return {
    id: dto.id,
    baseCryptoId: dto.baseCryptoId,
    quoteCryptoId: dto.quoteCryptoId,
    currentPrice: dto.currentPrice,
    feePercent: dto.feePercent,
    active: dto.active,
    oraclePaused: dto.oraclePaused,
    baseSymbol: dto.baseCrypto.symbol,
    quoteSymbol: dto.quoteCrypto.symbol,
  };
}

export const swapApi = {
  getPairs: () =>
    apiClient.get<SwapPairDTO[]>('/parExchange').then((rows) =>
      (rows ?? []).map(normalizePair).filter((p): p is SwapPair => p !== null && p.active),
    ),
  getQuote: (req: QuoteRequest) =>
    apiClient.post<QuoteResponse>('/intercambioExchange/calculate', {
      pairId: req.pairId,
      baseAmount: req.baseAmount,
      type: req.type,
    }),
  // Advisory ONLY. The check-limit endpoint rejects anything whose typeof !== 'number',
  // so we convert the canonical amount to a Number at THIS wire boundary — the one
  // sanctioned exception to the money-string rule (see plan Global Constraints). The
  // authoritative daily-limit enforcement is server-side at execution
  // (EXCHANGE_DAILY_LIMIT_EXCEEDED); this result must never be the sole submit gate.
  checkLimit: (quoteAmount: string) =>
    apiClient.post<CheckLimitResponse>('/intercambioExchange/check-limit', {
      quoteAmount: Number(quoteAmount),
    }),
};
