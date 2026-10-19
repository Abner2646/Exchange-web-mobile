'use client';
import React from 'react';
import { Button } from '../Button/Button';
import styles from './ErrorState.module.css';

const AlertIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </svg>
);

export interface ErrorStateProps {
  title: string;
  /** How to recover — not an apology, not vague. */
  message?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ title, message, onRetry, retryLabel = 'Reintentar', className }) => (
  <div role="alert" className={[styles.root, className].filter(Boolean).join(' ')}>
    <span className={styles.icon}><AlertIcon /></span>
    <p className={styles.title}>{title}</p>
    {message && <p className={styles.message}>{message}</p>}
    {onRetry && (
      <div className={styles.action}>
        <Button variant="secondary" size="small" onClick={onRetry}>{retryLabel}</Button>
      </div>
    )}
  </div>
);

export interface InlineErrorProps {
  children: React.ReactNode;
  className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({ children, className }) => (
  <span role="alert" className={[styles.inline, className].filter(Boolean).join(' ')}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
    {children}
  </span>
);
