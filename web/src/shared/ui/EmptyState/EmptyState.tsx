'use client';
import React from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** A muted line-icon (optional). */
  icon?: React.ReactNode;
  title: string;
  message?: React.ReactNode;
  /** One primary action — an invitation to act, never a dead end. */
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, action, className }) => (
  <div className={[styles.root, className].filter(Boolean).join(' ')}>
    {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
    <p className={styles.title}>{title}</p>
    {message && <p className={styles.message}>{message}</p>}
    {action && <div className={styles.action}>{action}</div>}
  </div>
);
