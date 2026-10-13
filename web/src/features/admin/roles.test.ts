import { describe, it, expect } from 'vitest';
import { roleLevel, isAdminRole, isSuperAdminRole } from './roles';

describe('roles', () => {
  it('maps the backend hierarchy incl. aliases (case-insensitive)', () => {
    expect(roleLevel('normal')).toBe(1);
    expect(roleLevel('Usuario')).toBe(1);
    expect(roleLevel('admin')).toBe(2);
    expect(roleLevel('administrator')).toBe(2);
    expect(roleLevel('SUPER_ADMIN')).toBe(3);
    expect(roleLevel('super-admin')).toBe(3);
    expect(roleLevel(undefined)).toBe(0);
  });
  it('isAdminRole is level>=2, isSuperAdminRole is level>=3', () => {
    expect(isAdminRole({ role: 'admin' })).toBe(true);
    expect(isAdminRole({ role: 'normal' })).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isSuperAdminRole({ role: 'admin' })).toBe(false);
    expect(isSuperAdminRole({ role: 'super_admin' })).toBe(true);
  });
});
