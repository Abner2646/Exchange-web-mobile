import '@/shared/styles/reset.css';
import '@/shared/styles/tokens.css';
import '@/shared/styles/a11y.css';

import type { Metadata } from 'next';
import Providers from '@/app/providers';

export const metadata: Metadata = {
  metadataBase: new URL('https://bitflow.community'),
  title: { default: 'BitFlow', template: '%s · BitFlow' },
  description: 'BitFlow — custodial crypto exchange.',
  robots: process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
    ? { index: true, follow: true }
    : { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
