import { isSuperAdminEmail } from './useSuperAdmin';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

assert(isSuperAdminEmail('admin@catat.com') === true, 'admin@catat.com is superadmin');
assert(isSuperAdminEmail('qolby@coreboylabs.com') === true, 'qolby@coreboylabs.com is superadmin');
assert(isSuperAdminEmail('regular@user.com') === false, 'regular@user.com is not superadmin');
assert(isSuperAdminEmail(null) === false, 'null is not superadmin');
assert(isSuperAdminEmail(undefined) === false, 'undefined is not superadmin');

console.log('useSuperAdmin tests pass');
