import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';
import { ApiError, api } from '../lib/http';

type LoginResponse = { token: string };
export function LoginPage() {
  const navigate = useNavigate(); const location = useLocation(); const { setToken } = useAuth();
  const [error, setError] = useState(''); const [isSubmitting, setIsSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setIsSubmitting(true);
    const data = new FormData(event.currentTarget);
    try { const result = await api<LoginResponse>('/usuario/login', { method: 'POST', body: JSON.stringify({ email: data.get('email'), password: data.get('password') }) }); setToken(result.token); navigate((location.state as { from?: string } | null)?.from ?? '/wallet', { replace: true }); }
    catch (cause) { setError(cause instanceof ApiError ? cause.code : 'INTERNAL_ERROR'); }
    finally { setIsSubmitting(false); }
  }
  return <form className="card" onSubmit={submit}><p className="eyebrow">Welcome back</p><h1>Sign in</h1><label className="field">Email<input required name="email" type="email" autoComplete="email" /></label><label className="field">Password<input required name="password" type="password" autoComplete="current-password" /></label>{error && <p className="form-error">{error}</p>}<button className="button" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button><p>New here? <Link to="/register">Create an account</Link>.</p></form>;
}
