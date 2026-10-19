import '@/shared/styles/reset.css';
import '@/shared/styles/tokens.css';
import '@/shared/styles/a11y.css';

import type { Metadata } from 'next';
import { Manrope, Inter } from 'next/font/google';
import Providers from '@/app/providers';

// UI type. Exposed as `--font-sans`; consumed by reset.css on <body>.
const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});
// Tighter figures for financial data (prices, %, volumes). Exposed as
// `--font-num` so only numeric cells opt in; headings/body stay on Manrope.
const inter = Inter({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-num',
  display: 'swap',
});

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
    <html lang="en" className={`${manrope.variable} ${inter.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
