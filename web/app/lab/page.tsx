'use client';

import { Button, CoinLogo, useSuccessFlash } from '@/shared/ui';
import styles from './lab.module.css';

const SYMS = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'LINK', 'FOOBAR', 'ZZ', 'QWE'];

export default function LabPage() {
  const { flash } = useSuccessFlash();
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.h1}>Lab · Swap</h1>
        <p className={styles.sub}>Sandbox para probar las modificaciones sin hacer swaps reales.</p>
      </header>

      <section className={styles.card}>
        <h2 className={styles.h2}>Animación de éxito — estándar de transacciones</h2>
        <p className={styles.p}>
          Pantalla completa en verde estilo Robinhood. Es el estándar compartido para cualquier botón
          que finalice una transacción (swap, retiro, trade, P2P).
        </p>
        <div className={styles.row}>
          <Button onClick={() => flash({ title: '¡Listo!', detail: 'Intercambiaste 0.001 BTC por 65.065 USDT' })}>
            Simular swap exitoso
          </Button>
          <Button variant="secondary" onClick={() => flash({ title: 'Retiro enviado', detail: '0.5 ETH en camino' })}>
            Simular retiro
          </Button>
          <Button variant="ghost" onClick={() => flash({ title: '¡Hecho!' })}>
            Solo flash
          </Button>
        </div>
      </section>

      <section className={styles.card}>
        <h2 className={styles.h2}>Íconos de monedas — nunca vacíos</h2>
        <p className={styles.p}>
          Monograma de color determinístico de base; la imagen del CDN se superpone cuando carga.
          Los símbolos inexistentes (FOOBAR, ZZ, QWE) se quedan en el monograma.
        </p>
        <div className={styles.logos}>
          {SYMS.map((s) => (
            <div key={s} className={styles.logoItem}>
              <CoinLogo symbol={s} size={44} />
              <span className={styles.logoLabel}>{s}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
