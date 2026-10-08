export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: 'var(--space-6, 24px)' }}>
      {children}
    </main>
  );
}
