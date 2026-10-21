import Link from 'next/link';
import styles from './auth.module.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell} data-theme="dark">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandDot} />BitFlow
        </Link>
        <main className={styles.card}>{children}</main>
      </div>
    </div>
  );
}
