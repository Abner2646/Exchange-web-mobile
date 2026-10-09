import type { Metadata } from 'next';
import { VerifyEmailForm } from '@/features/auth';

export const metadata: Metadata = { title: 'Verify email', robots: { index: false, follow: false } };

export default function VerifyEmailPage() {
  return <VerifyEmailForm />;
}
