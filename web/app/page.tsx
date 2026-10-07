import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BitFlow — Custodial crypto exchange',
  description:
    'Buy, swap, and trade crypto on BitFlow — a custodial exchange with audit-grade controls.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'BitFlow — Custodial crypto exchange',
    description: 'Buy, swap, and trade crypto on BitFlow.',
    url: 'https://bitflow.community/',
    siteName: 'BitFlow',
    type: 'website',
  },
};

export default function Home() {
  return (
    <main>
      <h1>BitFlow</h1>
      <p>A custodial crypto exchange with audit-grade controls.</p>
    </main>
  );
}
