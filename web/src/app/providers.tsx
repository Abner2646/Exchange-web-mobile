'use client';

import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LocaleProvider } from '@/shared/i18n';
import { ThemeProvider } from '@/shared/theme';
import { SuccessFlashProvider } from '@/shared/ui';
import { captureFirstTouch } from '@/shared/analytics/firstTouch';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  // Record first-touch attribution on the very first page load of the session.
  useEffect(() => { captureFirstTouch(); }, []);

  const tree = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LocaleProvider>
          <SuccessFlashProvider>{children}</SuccessFlashProvider>
        </LocaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

  if (GOOGLE_CLIENT_ID) {
    return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{tree}</GoogleOAuthProvider>;
  }
  return tree;
}
