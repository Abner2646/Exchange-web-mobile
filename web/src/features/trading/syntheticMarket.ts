// Client-side synthetic market depth + trades. DISPLAY ONLY — purely cosmetic, never
// sent anywhere and never the money path. The exchange's real order book/trades live
// in the backend; for the demo there are no real counterparties, so we render a
// plausible book + tape anchored to the pair's REAL last price so the terminal looks
// alive. (Owner decision: hardcode the orders in the front.)
import type { OrderBook, OrderBookEntry, RecentTrade, OrderSide } from './types';

const round = (n: number, dp: number) => Number(n.toFixed(Math.max(0, dp)));

/** A ladder of bids (below mid) and asks (above mid) with cumulative totals. */
export function makeOrderBook(
  mid: number,
  { levels = 12, pricePrecision = 2, quantityPrecision = 6 }: { levels?: number; pricePrecision?: number; quantityPrecision?: number } = {},
): OrderBook {
  const asks: OrderBookEntry[] = [];
  const bids: OrderBookEntry[] = [];
  if (!(mid > 0)) return { bids, asks, timestamp: new Date().toISOString() };
  const step = Math.max(mid * 0.0002, 10 ** -pricePrecision); // ~2 bps per level
  let askTotal = 0;
  let bidTotal = 0;
  for (let i = 1; i <= levels; i++) {
    const askQty = round(Math.random() * 1.4 + 0.05, quantityPrecision);
    const bidQty = round(Math.random() * 1.4 + 0.05, quantityPrecision);
    askTotal = round(askTotal + askQty, quantityPrecision);
    bidTotal = round(bidTotal + bidQty, quantityPrecision);
    asks.push({ price: round(mid + step * i, pricePrecision), quantity: askQty, total: askTotal, orders: 1 });
    bids.push({ price: round(mid - step * i, pricePrecision), quantity: bidQty, total: bidTotal, orders: 1 });
  }
  return { bids, asks, timestamp: new Date().toISOString() };
}

/** A tape of recent trades jittered around mid, newest first. */
export function makeRecentTrades(
  mid: number,
  { count = 22, pricePrecision = 2, quantityPrecision = 6 }: { count?: number; pricePrecision?: number; quantityPrecision?: number } = {},
): RecentTrade[] {
  if (!(mid > 0)) return [];
  const now = Date.now();
  const trades: RecentTrade[] = [];
  for (let i = 0; i < count; i++) {
    const side: OrderSide = Math.random() > 0.5 ? 'buy' : 'sell';
    const price = round(mid * (1 + (Math.random() - 0.5) * 0.0012), pricePrecision);
    trades.push({
      id: `sim-${i}`,
      price,
      quantity: round(Math.random() * 0.9 + 0.01, quantityPrecision),
      side,
      createdAt: new Date(now - i * 9000).toISOString(),
    });
  }
  return trades;
}
