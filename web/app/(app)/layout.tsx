'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { session } from '@/shared/api';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const authed = session.hasToken();

  useEffect(() => {
    if (!authed) router.replace('/login');
  }, [authed, router]);

  if (!authed) return null;
  return <>{children}</>;
}
