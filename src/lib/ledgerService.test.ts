import {
  generateInviteCode,
  formatWhatsAppInviteText,
  createInitialLedger,
  reconcileOrPreserveLedger,
  addMemberToLedger,
} from './ledgerService';
import type { LedgerMember } from './schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// 1. generateInviteCode
const code1 = generateInviteCode();
assert(code1.length === 6, 'generates 6-char code');
assert(/^[A-Z0-9]+$/.test(code1), 'alphanumeric uppercase');
// Ensure it doesn't contain confusing characters like '0', 'O', '1', 'I'
assert(!/[0O1I]/.test(code1), 'excludes confusing chars');

// Deterministic seed support
const seeded1 = generateInviteCode(6, 'user_qolby_123');
const seeded2 = generateInviteCode(6, 'user_qolby_123');
assert(seeded1 === seeded2, 'same seed produces identical invite code');
assert(seeded1.length === 6, 'seeded code is 6 chars');
assert(!/[0O1I]/.test(seeded1), 'seeded code excludes confusing chars');

// Different user produces different code
const seededOther = generateInviteCode(6, 'user_other_456');
assert(seeded1 !== seededOther, 'different users get different codes');

// 2. formatWhatsAppInviteText
const msg = formatWhatsAppInviteText('Keluarga Qolby', code1, 'https://catat-8897d.web.app');
assert(msg.includes('Keluarga Qolby'), 'includes ledger name');
assert(msg.includes(code1), 'includes invite code');
assert(msg.includes('https://catat-8897d.web.app/join?code='), 'includes join link');

// 3. createInitialLedger & addMemberToLedger
const ledger = createInitialLedger({ uid: 'u1', displayName: 'Qolby', email: 'q@test.com' }, 'Keluarga Qolby');
assert(ledger.ownerUid === 'u1', 'sets owner');
assert(ledger.members['u1']?.role === 'owner', 'sets owner role');

// Kode undangan baru acak, tidak diturunkan dari UID, agar tidak bisa ditebak dari ID ledger
const ledgerAttempt2 = createInitialLedger({ uid: 'u1', displayName: 'Qolby', email: 'q@test.com' });
assert(ledger.inviteCode !== ledgerAttempt2.inviteCode, 'invite code is random, not derived from uid');
assert(
  createInitialLedger({ uid: 'u1' }, undefined, 'ABC234').inviteCode === 'ABC234',
  'uses the provided invite code'
);

const newMember: LedgerMember = {
  uid: 'u2',
  name: 'Sarah',
  email: 's@test.com',
  role: 'member',
  joinedAt: Date.now(),
};
const updated = addMemberToLedger(ledger, newMember);
assert(updated.members['u2']?.name === 'Sarah', 'adds member');

// Test preserving existing ledger (does not regenerate inviteCode or wipe members)
const reconciled = reconcileOrPreserveLedger(
  {
    ...updated,
    inviteCode: 'OLD999',
  },
  { uid: 'u1', displayName: 'Qolby Updated' },
  'Keluarga Bahagia'
);
assert(reconciled.inviteCode === 'OLD999', 'strictly preserves existing custom/established invite code');
assert(reconciled.members['u2']?.name === 'Sarah', 'preserves existing members');
assert(reconciled.name === 'Keluarga Bahagia', 'updates name when supplied');

console.log('ledgerService tests pass');
