'use client';
import React, { forwardRef, TextareaHTMLAttributes } from 'react';
import styles from './controls.module.css';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={[styles.textarea, className].filter(Boolean).join(' ')}
      {...props}
    />
  )
);

Textarea.displayName = 'Textarea';
