'use client';
import React, { CSSProperties, useEffect, useMemo, useState } from 'react';
import { iconUrl, knownIconUrl } from '@/shared/lib/coinIcon';
import styles from './CoinLogo.module.css';

export interface CoinLogoProps {
  symbol: string;
  /** Preferred external image (e.g. a live CoinGecko URL); tried after our pinned catalog icon. */
  src?: string;
  /** Pixel size of the round logo. Default 28. */
  size?: number;
  className?: string;
  style?: CSSProperties;
}

// Deterministic, legible hue per symbol so the monogram is stable across renders.
function monogramColor(symbol: string): string {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) % 360;
  return `hsl(${h} 58% 42%)`;
}

export const CoinLogo: React.FC<CoinLogoProps> = ({ symbol, src, size = 28, className, style }) => {
  const sym = (symbol || '?').toUpperCase();

  // Candidate chain, most-reliable first: our pinned catalog URL → the caller's external
  // image (live CoinGecko) → a generic by-symbol guess. On error we advance; when the list
  // is exhausted the coloured monogram shows as the fallback.
  const candidates = useMemo(() => {
    const list = [knownIconUrl(sym), src].filter((x): x is string => !!x);
    if (list.length === 0) list.push(iconUrl(sym));
    return Array.from(new Set(list));
  }, [sym, src]);

  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // Reset when the coin (or its candidate list) changes so a reused instance re-attempts
  // from the top and re-shows the monogram until the new image paints.
  const key = candidates.join('|');
  useEffect(() => { setIdx(0); setLoaded(false); }, [key]);

  const current = idx < candidates.length ? candidates[idx] : null;
  const dimension = { width: size, height: size, fontSize: size } as CSSProperties;

  // The monogram (coloured circle + letters) is the FALLBACK: it shows only while the image
  // is loading or after every candidate failed. Once the image paints we hide it — otherwise
  // a transparent coin PNG would let the monogram bleed through behind the logo. The image is
  // revealed with no onLoad gating risk because a cached <img> is caught via `complete` on the
  // ref; a fresh one fires onLoad.
  const showMonogram = !loaded;

  return (
    <span
      className={[styles.logo, className].filter(Boolean).join(' ')}
      style={{ ...dimension, backgroundColor: showMonogram ? monogramColor(sym) : 'transparent', ...style }}
      title={sym}
    >
      {showMonogram && <span className={styles.fallback} aria-hidden="true">{sym.slice(0, 3)}</span>}
      {current && (
        // Remote CDN images; next/image isn't worth the config for coin logos.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current}
          ref={(el) => { if (el && el.complete && el.naturalWidth > 0) setLoaded(true); }}
          className={styles.img}
          // Kept invisible until it actually paints, so a loading/broken image never flashes
          // the native broken-image icon over the monogram.
          style={{ opacity: loaded ? 1 : 0 }}
          src={current}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => { setLoaded(false); setIdx((i) => i + 1); }}
        />
      )}
    </span>
  );
};
