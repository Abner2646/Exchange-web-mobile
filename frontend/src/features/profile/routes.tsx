import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProfileView } from './components/ProfileView';
import { EmailChangeForm } from './components/EmailChangeForm';

export const ProfileRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={
        <div>
          <ProfileView />
          <hr />
          <EmailChangeForm />
        </div>
      } />
    </Routes>
  );
};
