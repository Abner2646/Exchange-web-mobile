'use client';

import { useEffect, useReducer, useState } from 'react';
import { useRouter } from 'next/navigation';
import { session } from '@/shared/api';
import { useCurrentUser } from '@/features/auth/queries';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const { data: user } = useCurrentUser();

  // The auth token lives in localStorage (client only). Reading it during the
  // initial render would make the server (no token → render nothing) disagree with
  // the first client render (token present → render the app), a hydration mismatch.
  // So we render nothing until mounted; server and first client render then agree,
  // and the guard resolves on the client right after.
  useEffect(() => { setHydrated(true); }, []);

  useEffect(() => {
    // A 401 clears the token via session.notifyUnauthorized but nothing else
    // re-renders this guard — force one so the fresh hasToken() read below runs.
    const unsubscribe = session.onUnauthorized(() => forceRender());
    return () => { unsubscribe(); };
  }, []);

  // Read the token FRESH every render so the guard reflects BOTH a 401-clear
  // (forced above) and a manual logout (useLogout clears the token + nulls the
  // user cache, which re-renders this component through useCurrentUser).
  const authed = session.hasToken();

  // A user who has not verified their email must finish verification before using
  // the app (money-path guard). We only redirect once the user has loaded and is
  // explicitly unverified — while loading we render optimistically.
  const mustVerifyEmail = user != null && user.emailVerified === false;

  useEffect(() => {
    if (!hydrated) return;
    if (!authed) {
      router.replace('/login');
      return;
    }
    if (mustVerifyEmail) {
      router.replace('/verify-email');
    }
  }, [hydrated, authed, mustVerifyEmail, router]);

  if (!hydrated || !authed || mustVerifyEmail) return null;
  return <>{children}</>;
}
