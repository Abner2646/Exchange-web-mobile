/* Coin logo URLs. Single source of truth shared by the public Home and the
   CoinLogo primitive. Mirrors the backend `crypto.iconUrl` field: a CoinGecko
   CDN image when we know the coin, otherwise the jsdelivr cryptocurrency-icons
   fallback by symbol. */

const COINGECKO_ICONS: Record<string, string> = {
  BTC: 'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png',
  ETH: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
  USDT: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png',
  BNB: 'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
  XRP: 'https://coin-images.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
  USDC: 'https://coin-images.coingecko.com/coins/images/6319/large/USDC.png',
  SOL: 'https://coin-images.coingecko.com/coins/images/4128/large/solana.png',
  DOGE: 'https://coin-images.coingecko.com/coins/images/5/large/dogecoin.png',
  LINK: 'https://coin-images.coingecko.com/coins/images/877/large/Chainlink_Logo_500.png',
  ADA: 'https://coin-images.coingecko.com/coins/images/975/large/cardano.png',
  UNI: 'https://coin-images.coingecko.com/coins/images/12504/large/uniswap-logo.png',
  AAVE: 'https://coin-images.coingecko.com/coins/images/12645/large/aave-token-round.png',
  OP: 'https://coin-images.coingecko.com/coins/images/25244/large/Token.png',
  MATIC: 'https://coin-images.coingecko.com/coins/images/4713/large/polygon.png',
};

export function iconUrl(symbol: string): string {
  return (
    COINGECKO_ICONS[symbol] ||
    `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${symbol.toLowerCase()}.svg`
  );
}
