import { Link } from 'react-router-dom';

export function HomePage() {
  return <section className="hero"><p className="eyebrow">Built for clear decisions</p><h1>Your assets, in focus.</h1><p className="lead">A rebuilding exchange interface designed around transparent balances, deliberate actions, and an API contract that protects monetary precision.</p><div className="hero-actions"><Link className="button" to="/register">Create account</Link><Link className="button secondary" to="/login">Sign in</Link></div></section>;
}
