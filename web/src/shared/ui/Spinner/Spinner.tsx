'use client';
import React, { CSSProperties } from 'react';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  /** CSS length for width/height. Default 1.25rem. */
  size?: number | string;
  /** Accessible label; rendered sr-only. Default "Cargando". */
  label?: string;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size, label = 'Cargando', className }) => (
  <span role="status" className={className}>
    <svg
      className={styles.spinner}
      style={{ '--size': typeof size === 'number' ? `${size}px` : size } as CSSProperties}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className={styles.track} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
    <span className="sr-only">{label}</span>
  </span>
);
