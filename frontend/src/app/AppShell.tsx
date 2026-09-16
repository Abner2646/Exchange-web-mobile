import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthProvider';

const navigation = [
  ['Wallet', '/wallet'],
  ['Swap', '/swap'],
  ['Trade', '/trade'],
  ['P2P', '/p2p'],
] as const;

export function AppShell() {
  const { isAuthenticated, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">exchange<span>.</span></Link>
        <nav aria-label="Primary navigation">
          {navigation.map(([label, to]) => (
            <NavLink key={to} to={to}>{label}</NavLink>
          ))}
        </nav>
        {isAuthenticated ? (
          <div className="account-actions"><Link to="/profile">Profile</Link><button className="text-button" onClick={logout}>Sign out</button></div>
        ) : (
          <div className="account-actions"><Link to="/login">Sign in</Link><Link className="button small" to="/register">Get started</Link></div>
        )}
      </header>
      <main><Outlet /></main>
      <footer>Demo portfolio project. Not a financial service.</footer>
    </div>
  );
}
