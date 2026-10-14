'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/features/auth/queries';
import { isAdminRole } from './roles';

export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading } = useCurrentUser();

  useEffect(() => {
    if (!isLoading && user !== undefined && !isAdminRole(user)) {
      router.replace('/dashboard');
    }
  }, [isLoading, user, router]);

  if (isLoading || user === undefined) return null;
  if (!isAdminRole(user)) return null;

  return <>{children}</>;
}
