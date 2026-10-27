'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// The signed-in dashboard IS the home (/), like the V1. This route just forwards
// there for any stale links/bookmarks. It stays under the (app) guard, so a
// signed-out visitor is still sent to /login first.
export default function DashboardPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return null;
}
