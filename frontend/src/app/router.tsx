import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { authRoutes, RequireAuth } from '../features/auth';
import { walletRoutes } from '../features/wallet';
import { depositRoutes } from '../features/deposit';
import { p2pRoutes } from '../features/p2p';
import { referralsRoutes } from '../features/referrals';
import { swapRoutes } from '../features/swap';
import { tradingRoutes } from '../features/trading';
import { ProfileRoutes } from '../features/profile';
import { session } from '../shared/api';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {authRoutes.map(r => (
        <Route key={r.path} path={r.path} element={r.element} />
      ))}

      <Route element={<RequireAuth />}>
        {walletRoutes.map(r => (
          <Route key={r.path} path={r.path?.startsWith('/') ? r.path : `/${r.path}`} element={r.element} />
        ))}
        {depositRoutes.map(r => (
          <Route key={r.path} path={r.path?.startsWith('/') ? r.path : `/${r.path}`} element={r.element} />
        ))}
        {p2pRoutes.map(r => (
          <Route key={r.path} path={r.path?.startsWith('/') ? r.path : `/${r.path}`} element={r.element} />
        ))}
        {referralsRoutes.map(r => (
          <Route key={r.path} path={r.path?.startsWith('/') ? r.path : `/${r.path}`} element={r.element} />
        ))}
        {swapRoutes.map(r => (
          <Route key={r.path} path={r.path?.startsWith('/') ? r.path : `/${r.path}`} element={r.element} />
        ))}
        {tradingRoutes.map(r => (
          <Route key={r.path} path={r.path?.startsWith('/') ? r.path : `/${r.path}`} element={r.element} />
        ))}
        <Route path="/profile/*" element={<ProfileRoutes />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const RootRedirect = () => {
  return session.hasToken() ? <Navigate to="/wallet" replace /> : <Navigate to="/login" replace />;
};

const NotFound = () => <div>404 Not Found</div>;
