import { describe, it, expect } from 'bun:test';
import { isSuperAdminEmail } from './useSuperAdmin';

describe('useSuperAdmin', () => {
  it('correctly identifies admin email format or known admin emails', () => {
    expect(isSuperAdminEmail('admin@catat.com')).toBe(true);
    expect(isSuperAdminEmail('qolby@coreboylabs.com')).toBe(true);
    expect(isSuperAdminEmail('regular@user.com')).toBe(false);
    expect(isSuperAdminEmail(null)).toBe(false);
    expect(isSuperAdminEmail(undefined)).toBe(false);
  });
});
