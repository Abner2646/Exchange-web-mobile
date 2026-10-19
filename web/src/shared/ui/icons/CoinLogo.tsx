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

export const CoinLogo: React.FC<CoinLogoProps> = ({ symbol, size = 28, className, style }) => {
  const [failed, setFailed] = useState(false);
  const dimension = { width: size, height: size } as CSSProperties;

  return (
    <span
      className={[styles.logo, className].filter(Boolean).join(' ')}
      style={{ ...dimension, fontSize: size, ...style }}
      title={symbol}
    >
      {failed ? (
        <span className={styles.fallback} aria-hidden="true">{symbol.slice(0, 3)}</span>
      ) : (
        // Remote CDN images; next/image isn't worth the config for coin logos.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.img}
          src={iconUrl(symbol)}
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
