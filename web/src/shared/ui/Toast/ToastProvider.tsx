'use client';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Toast, ToastData, ToastTone } from './Toast';
import styles from './toast.module.css';

export interface ToastOptions {
  tone?: ToastTone;
  title: string;
  message?: string;
  /** Auto-dismiss after this many ms. 0 disables auto-dismiss. Default 5000. */
  duration?: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
};

let seq = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  }, []);

  const toast = useCallback(
    ({ tone = 'info', title, message, duration = 5000 }: ToastOptions) => {
      const id = `toast-${++seq}`;
      setToasts((list) => [...list, { id, tone, title, message }]);
      if (duration > 0) {
        timers.current[id] = setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className={styles.viewport} aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onClose={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
