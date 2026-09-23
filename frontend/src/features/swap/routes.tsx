import React from 'react';
import { RouteObject } from 'react-router-dom';
import { SwapWidget } from './components/SwapWidget';

export const swapRoutes: RouteObject[] = [
  {
    path: 'swap',
    element: <SwapWidget />,
  },
];

