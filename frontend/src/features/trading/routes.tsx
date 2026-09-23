import React from 'react';
import { RouteObject } from 'react-router-dom';
import { TradingTerminal } from './components/TradingTerminal';

export const tradingRoutes: RouteObject[] = [
  {
    path: 'trading',
    element: <TradingTerminal />,
  }
];
