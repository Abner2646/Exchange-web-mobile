'use client';
import React, { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'brand' | 'success' | 'error' | 'warning' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', className, children, ...props }) => (
  <span className={[styles.badge, styles[`tone-${tone}`], className].filter(Boolean).join(' ')} {...props}>
    {children}
  </span>
);
