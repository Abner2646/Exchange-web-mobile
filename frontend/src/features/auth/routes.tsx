import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { RegisterForm } from './components/RegisterForm';
import { LoginForm } from './components/LoginForm';
import { VerifyEmailForm } from './components/VerifyEmailForm';
import { session } from '../../shared/api';
import { useUser } from './queries';

export const authRoutes = [
  { path: '/register', element: <RegisterForm /> },
  { path: '/login', element: <LoginForm /> },
  { path: '/verify-email', element: <VerifyEmailForm /> },
];

export const RequireAuth: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  if (!session.hasToken()) {
    return <Navigate to="/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export const RequireVerifiedEmail: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { data: user, isLoading } = useUser();

  if (isLoading) {
    return <div>Loading...</div>; // Could be a loading spinner component
  }

  if (!user?.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
