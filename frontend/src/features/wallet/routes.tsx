import React from 'react';
import { RouteObject } from 'react-router-dom';
import { BalancesView } from './components/BalancesView';

export const walletRoutes: RouteObject[] = [
  {
    path: '/wallet',
    element: <BalancesView />,
  },
];
