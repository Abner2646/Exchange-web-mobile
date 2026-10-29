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
  // Track load status per-src. Resetting on `src` change is what fixes the badge
  // going blank when the symbol swaps (e.g. the swap flip reuses this instance):
  // stale loaded/failed from the previous coin no longer leaks into the new one.
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  useEffect(() => setStatus('loading'), [src]);
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
      {status !== 'failed' && (
        // Remote CDN images; next/image isn't worth the config for coin logos.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          className={styles.img}
          style={{ opacity: status === 'loaded' ? 1 : 0 }}
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('failed')}
        />
      )}
    </span>
  );
};
