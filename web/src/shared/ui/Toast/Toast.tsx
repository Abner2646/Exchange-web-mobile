'use client';
import React from 'react';
import styles from './toast.module.css';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  tone?: ToastTone;
  title: string;
  message?: string;
}

export interface ToastProps extends ToastData {
  onClose: (id: string) => void;
  /** Spanish close label for the icon button. */
  closeLabel?: string;
}

export const Toast: React.FC<ToastProps> = ({ id, tone = 'info', title, message, onClose, closeLabel = 'Cerrar' }) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={[styles.toast, styles[`tone-${tone}`]].join(' ')}
  >
    <div className={styles.body}>
      <div className={styles.title}>{title}</div>
      {message && <div className={styles.message}>{message}</div>}
    </div>
    <button type="button" className={styles.close} aria-label={closeLabel} onClick={() => onClose(id)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  </div>
);
