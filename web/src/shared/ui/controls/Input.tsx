'use client';
import React, { forwardRef, InputHTMLAttributes } from 'react';
import styles from './controls.module.css';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={[styles.control, className].filter(Boolean).join(' ')}
      {...props}
    />
  )
);

Input.displayName = 'Input';
