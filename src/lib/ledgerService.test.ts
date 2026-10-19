import {
  generateInviteCode,
  formatWhatsAppInviteText,
  createInitialLedger,
  addMemberToLedger,
  findDuplicateReceipt,
} from './ledgerService';
import type { LedgerMember, Transaction } from './schemas';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

// 1. generateInviteCode
const code1 = generateInviteCode();
assert(code1.length === 6, 'generates 6-char code');
assert(/^[A-Z0-9]+$/.test(code1), 'alphanumeric uppercase');
// Ensure it doesn't contain confusing characters like '0', 'O', '1', 'I'
assert(!/[0O1I]/.test(code1), 'excludes confusing chars');

// 2. formatWhatsAppInviteText
const msg = formatWhatsAppInviteText('Keluarga Qolby', code1, 'https://catat-8897d.web.app');
assert(msg.includes('Keluarga Qolby'), 'includes ledger name');
assert(msg.includes(code1), 'includes invite code');
assert(msg.includes('https://catat-8897d.web.app/join?code='), 'includes join link');

// 3. createInitialLedger & addMemberToLedger
const ledger = createInitialLedger({ uid: 'u1', displayName: 'Qolby', email: 'q@test.com' }, 'Keluarga Qolby');
assert(ledger.ownerUid === 'u1', 'sets owner');
assert(ledger.members['u1']?.role === 'owner', 'sets owner role');

const newMember: LedgerMember = {
  uid: 'u2',
  name: 'Sarah',
  email: 's@test.com',
  role: 'member',
  joinedAt: Date.now(),
};
const updated = addMemberToLedger(ledger, newMember);
assert(updated.members['u2']?.name === 'Sarah', 'adds member');

// 4. findDuplicateReceipt
const existingTx = {
  id: 'tx_1',
  type: 'expense' as const,
  amount: 10000,
  date: 1000,
  accountId: 'acc_1',
  categoryId: 'cat_1',
  referenceKey: 'tiktok#123',
  createdAt: 1000,
  updatedAt: 1000,
} as Transaction;

assert(findDuplicateReceipt([existingTx], 'tiktok#123')?.id === 'tx_1', 'finds duplicate');
assert(findDuplicateReceipt([existingTx], 'tiktok#456') === null, 'returns null when not found');
assert(findDuplicateReceipt([existingTx], null) === null, 'returns null for null ref');

console.log('ledgerService tests pass');
