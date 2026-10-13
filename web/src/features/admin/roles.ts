const LEVEL: Record<string, 1 | 2 | 3> = {
  normal: 1, usuario: 1, user: 1,
  admin: 2, administrator: 2,
  super_admin: 3, superadmin: 3, 'super-admin': 3,
};

export function roleLevel(role?: string): 0 | 1 | 2 | 3 {
  return (LEVEL[String(role ?? '').toLowerCase()] ?? 0) as 0 | 1 | 2 | 3;
}

export function isAdminRole(user?: { role?: string } | null): boolean {
  return roleLevel(user?.role) >= 2;
}

export function isSuperAdminRole(user?: { role?: string } | null): boolean {
  return roleLevel(user?.role) >= 3;
}
