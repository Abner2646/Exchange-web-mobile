import { describe, it, expect } from 'vitest';
import type { SwapPair, QuoteResponse, ExecuteSwapRequest } from './types';

describe('swap types', () => {
  it('compiles with representative values', () => {
    const pair: SwapPair = {
      id: 'p1', baseCryptoId: 'b1', quoteCryptoId: 'q1',
      currentPrice: '65000.00000000', feePercent: '0.1', active: true,
      oraclePaused: false, baseSymbol: 'BTC', quoteSymbol: 'USDT',
    };
    const req: ExecuteSwapRequest = { pairId: 'p1', type: 'buy', baseAmount: '0.5', compartimento: 'funding' };
    const q: QuoteResponse['calculo'] = {
      baseAmount: '0.5', quoteAmount: '32500', feePercent: '0.1', feeAmount: '32.5',
      impactoSlippage: 0, finalAmount: '32532.5', direccion: 'buy', precioEfectivo: '65000',
    };
    expect(pair.oraclePaused).toBe(false);
    expect(req.type).toBe('buy');
    expect(q.direccion).toBe('buy');
  });
});
