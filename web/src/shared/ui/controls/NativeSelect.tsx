'use client';
import React, { forwardRef, SelectHTMLAttributes } from 'react';
import styles from './controls.module.css';

export type NativeSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/* Raw styled <select> for simple forms. For rich pickers (option icons, coin
   logos, a themed panel) use the custom <Select> instead — the native option
   list can't render images and its panel isn't stylable. */
export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
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

NativeSelect.displayName = 'NativeSelect';
