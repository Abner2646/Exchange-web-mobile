'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import styles from './SuccessFlash.module.css';

export interface FlashOptions {
  /** Headline, e.g. "¡Listo!". */
  title?: string;
  /** Secondary line, e.g. "Intercambiaste 0.001 BTC". */
  detail?: string;
  /** Visible time before auto-dismiss (ms). Default 1600. */
  duration?: number;
}

interface SuccessFlashContextValue {
  flash: (opts?: FlashOptions) => void;
}

const SuccessFlashContext = createContext<SuccessFlashContextValue | null>(null);

/**
 * The shared "transaction succeeded" standard: a full-screen green flood with a
 * drawn check (Robinhood-style). Any button that finalizes a money transaction
 * (swap, withdrawal, trade, P2P release) calls `flash()` on success.
 * Returns a no-op outside a provider so components/tests don't crash.
 */
export function useSuccessFlash(): SuccessFlashContextValue {
  return useContext(SuccessFlashContext) ?? { flash: () => {} };
}

export function SuccessFlashProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FlashOptions | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  const dismiss = useCallback(() => {
    setLeaving(true);
    const t = window.setTimeout(() => {
      setState(null);
      setLeaving(false);
    }, 320);
    timers.current.push(t);
  }, []);

  const flash = useCallback(
    (opts: FlashOptions = {}) => {
      clearTimers();
      setLeaving(false);
      setState(opts);
      const t = window.setTimeout(dismiss, opts.duration ?? 1600);
      timers.current.push(t);
    },
    [dismiss],
  );

  useEffect(() => clearTimers, []);

  return (
    <SuccessFlashContext.Provider value={{ flash }}>
      {children}
      {state && (
        <div
          className={[styles.overlay, leaving ? styles.leaving : ''].filter(Boolean).join(' ')}
          role="alert"
          aria-live="assertive"
          onClick={dismiss}
        >
          <span className={styles.check} aria-hidden="true">
            <svg viewBox="0 0 52 52" className={styles.checkSvg}>
              <circle className={styles.checkCircle} cx="26" cy="26" r="24" />
              <path className={styles.checkMark} d="M14 27 l8 8 l16 -18" />
            </svg>
          </span>
          {state.title && <p className={styles.title}>{state.title}</p>}
          {state.detail && <p className={styles.detail}>{state.detail}</p>}
        </div>
      )}
    </SuccessFlashContext.Provider>
  );
}
