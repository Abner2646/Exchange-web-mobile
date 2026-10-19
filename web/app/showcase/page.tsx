import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ShowcaseClient from './ShowcaseClient';

// Dev-only primitive gallery (Fase A review). Never indexed; 404s in production
// so it can't ship accidentally. Remove when the foundations are signed off.
export const metadata: Metadata = {
  title: 'UI showcase (dev)',
  robots: { index: false, follow: false },
};

export default function ShowcasePage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  return <ShowcaseClient />;
}
