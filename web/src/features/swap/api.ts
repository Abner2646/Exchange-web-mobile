import { apiClient } from '@/shared/api';
import type { SwapPair, SwapPairDTO, QuoteRequest, QuoteResponse } from './types';

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
};
