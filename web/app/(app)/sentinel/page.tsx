'use client';

// Owner-only honeypot intelligence. Deliberately NOT a tab in /admin (that panel is shown
// to trapped attackers too, so a visible "Honeypot" tab would blow the deception). This is a
// separate route the owner navigates to directly; a trapped attacker who guesses it gets a
// fake identity from the guard (email ≠ owner) and is bounced out.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminGate } from '@/features/admin/AdminGate';
import { useCurrentUser } from '@/features/auth/queries';
import { HoneypotView } from '@/features/admin/components/HoneypotView';

const OWNER_EMAIL = 'grgurichabner@gmail.com';

function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && user && user.email !== OWNER_EMAIL) router.replace('/');
  }, [isLoading, user, router]);
  if (isLoading || !user || user.email !== OWNER_EMAIL) return null;
  return <>{children}</>;
}

export default function SentinelPage() {
  return (
    <AdminGate>
      <OwnerOnly>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: 'var(--spacing-xl) var(--spacing-lg) var(--spacing-xxl)' }}>
          <HoneypotView />
        </div>
      </OwnerOnly>
    </AdminGate>
  );
}
