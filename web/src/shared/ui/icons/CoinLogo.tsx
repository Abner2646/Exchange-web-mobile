'use client';
import React, { CSSProperties, useEffect, useState } from 'react';
import { iconUrl } from '@/shared/lib/coinIcon';
import styles from './CoinLogo.module.css';

export interface CoinLogoProps {
  symbol: string;
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

export const CoinLogo: React.FC<CoinLogoProps> = ({ symbol, size = 28, className, style }) => {
  const sym = (symbol || '?').toUpperCase();
  const src = iconUrl(sym);
  const [failed, setFailed] = useState(false);
  // Reset on symbol change so reusing this instance for another coin (e.g. the swap
  // flip) re-attempts the new image instead of staying hidden by a stale failure.
  useEffect(() => setFailed(false), [src]);
  const dimension = { width: size, height: size, fontSize: size } as CSSProperties;

  // The coloured monogram is ALWAYS rendered underneath; the CDN image simply paints
  // over it once it loads (no onLoad gating — a cached image that loads before React
  // attaches the handler would otherwise never reveal). On error we drop the <img>.
  return (
    <span
      className={[styles.logo, className].filter(Boolean).join(' ')}
      style={{ ...dimension, backgroundColor: monogramColor(sym), ...style }}
      title={sym}
    >
      <span className={styles.fallback} aria-hidden="true">{sym.slice(0, 3)}</span>
      {!failed && (
        // Remote CDN images; next/image isn't worth the config for coin logos.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          className={styles.img}
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
};
