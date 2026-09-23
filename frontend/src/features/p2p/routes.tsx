import React from 'react';
import { RouteObject } from 'react-router-dom';
import { MarketplaceView } from './components/MarketplaceView';
import { TradeFlow } from './components/TradeFlow';

export const p2pRoutes: RouteObject[] = [
  {
    path: '/p2p',
    element: <MarketplaceView />,
  },
  {
    path: '/p2p/trade/:id',
    element: <TradeFlow />,
  }
];
