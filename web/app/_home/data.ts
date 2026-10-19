/* Shared sample content for the public Home and its design variants.
   SAMPLE for design review — no API/DB. In the wired version MARKET/GAINERS
   come from GET /api/crypto/public/active (each crypto's `iconUrl` field);
   here the icon URLs mirror backend crypto.iconUrl (CoinGecko CDN + the
   jsdelivr cryptocurrency-icons fallback). Keep this the single source of
   truth so every variant renders identical content and only the look changes. */

export type Coin = {
  symbol: string;
  name: string;
  price: string;
  change24h: number;
  change7d: number;
  volume: string;
  marketCap: string;
};

// Single source of truth now lives in shared/lib so the CoinLogo primitive and
// the Home share it. Re-exported here for existing Home imports.
export { iconUrl } from '@/shared/lib/coinIcon';

export const MARKET: Coin[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: '111,979.28', change24h: 1.38, change7d: 4.12, volume: '$28.4B', marketCap: '$2.21T' },
  { symbol: 'ETH', name: 'Ethereum', price: '3,995.77', change24h: 0.75, change7d: 2.86, volume: '$14.1B', marketCap: '$481B' },
  { symbol: 'USDT', name: 'Tether', price: '1.00', change24h: 0.01, change7d: 0.0, volume: '$52.0B', marketCap: '$140B' },
  { symbol: 'BNB', name: 'BNB', price: '624.10', change24h: -0.42, change7d: -1.2, volume: '$1.9B', marketCap: '$90B' },
  { symbol: 'SOL', name: 'Solana', price: '194.89', change24h: 3.37, change7d: 9.44, volume: '$4.2B', marketCap: '$92B' },
  { symbol: 'XRP', name: 'XRP', price: '2.49', change24h: 0.9, change7d: -2.15, volume: '$3.1B', marketCap: '$142B' },
  { symbol: 'USDC', name: 'USD Coin', price: '1.00', change24h: 0.0, change7d: 0.0, volume: '$7.8B', marketCap: '$43B' },
];

export const GAINERS: { symbol: string; price: string; change: number }[] = [
  { symbol: 'SOL', price: '194.89', change: 3.37 },
  { symbol: 'LINK', price: '23.64', change: 2.91 },
  { symbol: 'ADA', price: '1.08', change: 2.44 },
  { symbol: 'UNI', price: '14.22', change: 2.18 },
  { symbol: 'AAVE', price: '312.40', change: 1.95 },
  { symbol: 'OP', price: '2.57', change: 1.72 },
  { symbol: 'MATIC', price: '0.58', change: 1.51 },
  { symbol: 'DOGE', price: '0.42', change: 1.38 },
];

/* "Why choose us" — end-user language, no internal/technical jargon. */
export const FEATURES: { title: string; body: string }[] = [
  {
    title: 'Comprá y vendé en segundos',
    body: 'Convertí entre más de 200 monedas al instante, con el precio claro antes de confirmar. Sin vueltas.',
  },
  {
    title: 'Tu dinero, siempre protegido',
    body: 'Cuidamos tus fondos con controles de nivel bancario y doble verificación. Vos operás tranquilo; de la seguridad nos ocupamos nosotros.',
  },
  {
    title: 'Sin comisiones sorpresa',
    body: 'Ves exactamente cuánto pagás antes de operar. Nada de letra chica ni costos ocultos.',
  },
  {
    title: 'Empezá en minutos',
    body: 'Creá tu cuenta, verificá tu identidad y hacé tu primera operación el mismo día, desde donde estés.',
  },
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: '¿Cómo empiezo a operar?',
    a: 'Regístrate con tu email, verifica tu identidad, deposita fondos y comienza a operar. Todo el proceso toma menos de 10 minutos.',
  },
  {
    q: '¿Qué comisiones cobran?',
    a: 'Nuestras comisiones son competitivas: 0.1% por transacción en trading spot y 0% en depósitos. Sin costos ocultos.',
  },
  {
    q: '¿Es seguro depositar mis fondos?',
    a: 'Sí. Custodia con control dual Maker-Checker sobre cada movimiento privilegiado, autenticación de dos factores y un libro de auditoría a prueba de manipulación.',
  },
  {
    q: '¿Cuánto tiempo tardan los retiros?',
    a: 'Los retiros on-chain se procesan tras los controles AML correspondientes. Los retiros grandes pasan por aprobación dual antes de liberarse.',
  },
  {
    q: '¿Ofrecen soporte al cliente?',
    a: 'Sí, nuestro equipo de soporte está disponible para resolver cualquier consulta sobre tu cuenta y tus operaciones.',
  },
  {
    q: '¿Puedo operar desde mi móvil?',
    a: 'La app móvil está en desarrollo. Mientras tanto, la web es completamente responsive y funciona desde cualquier dispositivo.',
  },
];

export const REGION_NOTICE = 'BitFlow: la app móvil aún no está disponible en tu región.';
