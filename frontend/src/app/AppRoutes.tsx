import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { WorkspacePage } from '../pages/WorkspacePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="wallet" element={<WorkspacePage title="Wallet" />} />
          <Route path="swap" element={<WorkspacePage title="Swap" />} />
          <Route path="trade" element={<WorkspacePage title="Trade" />} />
          <Route path="p2p" element={<WorkspacePage title="P2P" />} />
          <Route path="profile" element={<WorkspacePage title="Profile" />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
