'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import styles from './SuccessFlash.module.css';

export interface FlashOptions {
  /** Headline, e.g. "¡Listo!". */
  title?: string;
  /** Secondary line, e.g. "Intercambiaste 0.001 BTC". */
  detail?: string;
  /** Visible time before auto-dismiss (ms). Default 2400. */
  duration?: number;
}

interface SuccessFlashContextValue {
  flash: (opts?: FlashOptions) => void;
}

const SuccessFlashContext = createContext<SuccessFlashContextValue | null>(null);

/**
 * The shared "transaction succeeded" standard: a full-screen brand-blue flood with
 * a confetti burst and a springing check (Robinhood-style). Any button that
 * finalizes a money transaction (swap, withdrawal, trade, P2P release) calls
 * `flash()` on success. Returns a no-op outside a provider so tests don't crash.
 */
export function useSuccessFlash(): SuccessFlashContextValue {
  return useContext(SuccessFlashContext) ?? { flash: () => {} };
}

const CONFETTI_COLORS = ['#ffffff', '#bfdbfe', '#93c5fd', '#60a5fa', '#fde68a', '#fca5a5', '#a7f3d0'];

function makeConfetti() {
  const N = 32;
  return Array.from({ length: N }, (_, i) => {
    const angle = (Math.PI * 2 * i) / N + Math.random() * 0.5;
    const dist = 150 + Math.random() * 280;
    return {
      id: i,
      style: {
        '--tx': `${Math.cos(angle) * dist}px`,
        '--ty': `${Math.sin(angle) * dist}px`,
        '--rot': `${Math.random() * 720 - 360}deg`,
        '--delay': `${Math.random() * 140}ms`,
        '--size': `${6 + Math.random() * 8}px`,
        background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      } as React.CSSProperties,
    };
  });
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
    }, 360);
    timers.current.push(t);
  }, []);

  const flash = useCallback(
    (opts: FlashOptions = {}) => {
      clearTimers();
      setLeaving(false);
      setState(opts);
      const t = window.setTimeout(dismiss, opts.duration ?? 2400);
      timers.current.push(t);
    },
    [dismiss],
  );

  useEffect(() => clearTimers, []);

  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const confetti = useMemo(() => (state && !reduced ? makeConfetti() : []), [state, reduced]);

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
          <div className={styles.confettiLayer} aria-hidden="true">
            {confetti.map((p) => (
              <span key={p.id} className={styles.confetti} style={p.style} />
            ))}
          </div>

          <span className={styles.badge} aria-hidden="true">
            <span className={styles.ring} />
            <span className={`${styles.ring} ${styles.ring2}`} />
            <span className={styles.check}>
              <svg viewBox="0 0 52 52" className={styles.checkSvg}>
                <circle className={styles.checkCircle} cx="26" cy="26" r="24" />
                <path className={styles.checkMark} d="M14 27 l8 8 l16 -18" />
              </svg>
            </span>
          </span>

          {state.title && <p className={styles.title}>{state.title}</p>}
          {state.detail && <p className={styles.detail}>{state.detail}</p>}
        </div>
      )}
    </SuccessFlashContext.Provider>
  );
}
