import React from 'react';
import { RouteObject, Outlet, Link } from 'react-router-dom';
import { MakerCheckerInbox } from './components/MakerCheckerInbox';
import { BusinessConfigEditor } from './components/BusinessConfigEditor';

const AdminLayout = () => (
  <div>
    <h1>Operator Dashboard</h1>
    <nav>
      <ul>
        <li><Link to="inbox">Maker-Checker Inbox</Link></li>
        <li><Link to="config">Business Config</Link></li>
      </ul>
    </nav>
    <Outlet />
  </div>
);

export const adminRoutes: RouteObject[] = [
  {
    path: 'admin',
    element: <AdminLayout />,
    children: [
      { path: 'inbox', element: <MakerCheckerInbox /> },
      { path: 'config', element: <BusinessConfigEditor /> },
      { path: '', element: <MakerCheckerInbox /> }
    ]
  }
];
