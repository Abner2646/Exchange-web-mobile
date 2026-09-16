import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

const TOKEN_KEY = 'token';
type AuthContextValue = { isAuthenticated: boolean; setToken: (token: string) => void; logout: () => void };
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setCurrentToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const value = useMemo<AuthContextValue>(() => ({
    isAuthenticated: Boolean(token),
    setToken: (nextToken) => { localStorage.setItem(TOKEN_KEY, nextToken); setCurrentToken(nextToken); },
    logout: () => { localStorage.removeItem(TOKEN_KEY); setCurrentToken(null); },
  }), [token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
