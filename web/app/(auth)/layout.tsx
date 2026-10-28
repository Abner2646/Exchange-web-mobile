import styles from './auth.module.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <main className={styles.card}>{children}</main>
    </div>
  );
}
