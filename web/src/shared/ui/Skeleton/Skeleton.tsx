'use client';
import React, { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  variant?: 'block' | 'text' | 'circle';
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({ variant = 'block', width, height, radius, className, style }) => (
  <span
    aria-hidden="true"
    className={[styles.skeleton, variant !== 'block' && styles[variant], className].filter(Boolean).join(' ')}
    style={{ width, height, borderRadius: radius, ...style }}
  />
);
