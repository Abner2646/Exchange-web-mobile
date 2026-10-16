import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './designs.module.css';

export const metadata: Metadata = {
  title: 'BitFlow — Exploración de diseño del Home',
  robots: { index: false, follow: false },
};

type Variant = {
  href: string;
  tag: string;
  name: string;
  blurb: string;
  swatches: string[];
  type: string;
};

const VARIANTS: Variant[] = [
  {
    href: '/',
    tag: 'Versión actual',
    name: 'Baseline — dark + azul',
    blurb: 'Tema oscuro #0A0E13 con acento azul. Manrope para títulos, Inter para los números. El punto de partida; se conserva tal cual.',
    swatches: ['#0A0E13', '#1E2329', '#3B82F6', '#10B981'],
    type: 'Manrope · Inter',
  },
  {
    href: '/designs/v2',
    tag: 'V2',
    name: 'Coinbase-clean (light)',
    blurb: 'Lienzo blanco, mucho aire, tinta navy y azul Coinbase. Display editorial Bricolage Grotesque; tabla "ledger" con hairlines.',
    swatches: ['#FFFFFF', '#0A1F44', '#0052FF', '#05A66B'],
    type: 'Bricolage Grotesque · Inter',
  },
  {
    href: '/designs/v3',
    tag: 'V3',
    name: 'Binance-dense (dark/oro)',
    blurb: 'Terminal de trader: ticker en vivo, densidad alta y la tabla como protagonista. Rajdhani condensada; números en Roboto Mono.',
    swatches: ['#0B0E11', '#1E2329', '#F0B90B', '#0ECB81'],
    type: 'Rajdhani · Roboto Mono',
  },
  {
    href: '/designs/v4',
    tag: 'V4',
    name: 'Fintech moderno (violeta)',
    blurb: 'Alto contraste, hero gigante y una firma de gradiente violeta. Mercados como lista de cards redondeadas. Display bold Syne.',
    swatches: ['#0D0B14', '#1F1B2E', '#8B5CF6', '#A78BFA'],
    type: 'Syne · Plus Jakarta · Space Grotesk',
  },
  {
    href: '/designs/v5',
    tag: 'V5',
    name: 'Coinbase-clean (dark)',
    blurb: 'El layout aireado de V2 pero con la paleta oscura y la tipografía del baseline: fondo #0A0E13, azul #3B82F6, Manrope + Inter.',
    swatches: ['#0A0E13', '#1E2329', '#3B82F6', '#10B981'],
    type: 'Manrope · Inter',
  },
];

export default function DesignsIndex() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>BitFlow · exploración de diseño</p>
        <h1 className={styles.title}>Elegí la dirección del Home</h1>
        <p className={styles.lead}>
          Cuatro versiones con el mismo contenido y las mismas secciones; lo que cambia es el look —
          paleta, tipografía, densidad y el tratamiento del hero, la tabla y el bloque de descarga.
          Abrí cada una y compará.
        </p>
      </header>

      <div className={styles.grid}>
        {VARIANTS.map((v) => (
          <Link key={v.href} href={v.href} className={styles.card}>
            <div className={styles.cardTop}>
              <span className={styles.tag}>{v.tag}</span>
              <div className={styles.swatches}>
                {v.swatches.map((c) => (
                  <span key={c} className={styles.swatch} style={{ background: c }} />
                ))}
              </div>
            </div>
            <h2 className={styles.cardName}>{v.name}</h2>
            <p className={styles.cardBlurb}>{v.blurb}</p>
            <div className={styles.cardFoot}>
              <span className={styles.typeLabel}>{v.type}</span>
              <span className={styles.open}>Abrir →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
