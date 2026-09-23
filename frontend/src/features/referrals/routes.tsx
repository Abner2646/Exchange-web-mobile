import React from 'react';
import { RouteObject } from 'react-router-dom';
import { ReferralsDashboard } from './components/ReferralsDashboard';

export const referralsRoutes: RouteObject[] = [
  {
    path: '/referrals',
    element: <ReferralsDashboard />,
  },
];
