'use client';

import { useCurrentUser, useLogout } from '@/features/auth/queries';

export default function DashboardPage() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  return (
    <section>
      <h1>Dashboard</h1>
      <p>You are signed in{user?.username ? ` as ${user.username}` : ''}.</p>
      <button type="button" onClick={logout}>Log out</button>
    </section>
  );
}
