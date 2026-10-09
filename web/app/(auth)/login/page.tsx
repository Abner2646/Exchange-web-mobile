import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false, follow: false } };

export default function LoginPage() {
  return <LoginForm />;
}
