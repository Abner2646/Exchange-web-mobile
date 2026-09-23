import React from 'react';
import { RouteObject } from 'react-router-dom';
import { MarketplaceView } from './components/MarketplaceView';

export const p2pRoutes: RouteObject[] = [
  {
    path: '/p2p',
    element: <MarketplaceView />,
  },
];
