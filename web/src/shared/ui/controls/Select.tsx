'use client';
import React, { forwardRef, SelectHTMLAttributes } from 'react';
import styles from './controls.module.css';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={[styles.select, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </select>
  )
);

Select.displayName = 'Select';
