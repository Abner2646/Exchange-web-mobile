import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { LocaleProvider } from '../shared/i18n';

// Global styles
import '../shared/styles/tokens.css';
import '../shared/styles/reset.css';
import '../shared/styles/a11y.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        {children}
      </LocaleProvider>
    </QueryClientProvider>
  );
};
