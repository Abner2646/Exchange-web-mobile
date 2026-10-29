'use client';
import React, { CSSProperties, useState } from 'react';
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
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const sym = (symbol || '?').toUpperCase();
  const dimension = { width: size, height: size, fontSize: size } as CSSProperties;

  // The coloured monogram is ALWAYS rendered underneath, so the badge is never an
  // empty circle while the remote CDN image is loading or if it fails outright.
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
          className={styles.img}
          style={{ opacity: loaded ? 1 : 0 }}
          src={iconUrl(sym)}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
};
