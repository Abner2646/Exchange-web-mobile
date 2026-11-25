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
  // is exhausted the coloured monogram underneath shows through (never a broken-image icon).
  const candidates = useMemo(() => {
    const list = [knownIconUrl(sym), src].filter((x): x is string => !!x);
    if (list.length === 0) list.push(iconUrl(sym));
    return Array.from(new Set(list));
  }, [sym, src]);

  const [idx, setIdx] = useState(0);
  // Reset when the coin (or its candidate list) changes, so reusing this instance for
  // another coin re-attempts from the top instead of staying on a stale failure.
  const key = candidates.join('|');
  useEffect(() => setIdx(0), [key]);

  const current = idx < candidates.length ? candidates[idx] : null;
  const dimension = { width: size, height: size, fontSize: size } as CSSProperties;

  // The coloured monogram is ALWAYS rendered underneath; the CDN image simply paints over
  // it once it loads (no onLoad gating — a cached image that loads before React attaches the
  // handler would otherwise never reveal). On error we advance to the next candidate.
  return (
    <span
      className={[styles.logo, className].filter(Boolean).join(' ')}
      style={{ ...dimension, backgroundColor: monogramColor(sym), ...style }}
      title={sym}
    >
      <span className={styles.fallback} aria-hidden="true">{sym.slice(0, 3)}</span>
      {current && (
        // Remote CDN images; next/image isn't worth the config for coin logos.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current}
          className={styles.img}
          src={current}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          onError={() => setIdx((i) => i + 1)}
        />
      )}
    </span>
  );
};
