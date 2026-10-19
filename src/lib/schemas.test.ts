import { transactionSchema, accountSchema, categorySchema } from './schemas';

function throws(fn: () => void, match: RegExp) {
  try {
    fn();
    throw new Error('Expected function to throw');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!match.test(msg)) throw new Error(`Expected error matching ${match}, got: ${msg}`);
  }
}

// Account
accountSchema.parse({
  id: 'acc-1',
  name: 'Tunai',
  kind: 'asset',
  balance: 50000,
  createdAt: Date.now(),
});

// Category
categorySchema.parse({
  id: 'cat-1',
  name: 'Makan',
  type: 'expense',
  createdAt: Date.now(),
});

// Transfer to same account fails
throws(() => {
  transactionSchema.parse({
    id: 'tx-1',
    type: 'transfer',
    amount: 10000,
    fromAccountId: 'acc-1',
    toAccountId: 'acc-1',
    date: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}, /Akun tujuan harus berbeda/);

// Transfer to different account passes
transactionSchema.parse({
  id: 'tx-2',
  type: 'transfer',
  amount: 10000,
  fromAccountId: 'acc-1',
  toAccountId: 'acc-2',
  date: Date.now(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// Negative amount fails
throws(() => {
  transactionSchema.parse({
    id: 'tx-3',
    type: 'expense',
    amount: -5000,
    accountId: 'acc-1',
    categoryId: 'cat-1',
    date: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}, /Too small/i);

// Test creatorSchema, transactionItemSchema, ledgerMemberSchema, ledgerSchema
import {
  creatorSchema,
  transactionItemSchema,
  ledgerMemberSchema,
  ledgerSchema,
} from './schemas';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

const validCreator = { uid: 'u123', name: 'Sarah', photoURL: 'https://example.com/p.jpg' };
assert(creatorSchema.parse(validCreator).name === 'Sarah', 'validates creator');

const validItem = { name: 'Susu UHT 1L', qty: 2, price: 18500, subtotal: 37000 };
assert(transactionItemSchema.parse(validItem).subtotal === 37000, 'validates line item');

const validMember = { uid: 'u123', name: 'Sarah', email: 's@test.com', role: 'member' as const, joinedAt: Date.now() };
assert(ledgerMemberSchema.parse(validMember).role === 'member', 'validates ledger member');

const validLedger = {
  id: 'led_1',
  name: 'Keluarga Qolby',
  ownerUid: 'u123',
  inviteCode: 'KATAT8',
  members: { u123: validMember },
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
assert(ledgerSchema.parse(validLedger).inviteCode === 'KATAT8', 'validates ledger');

const txWithMeta = {
  id: 'tx_meta_1',
  type: 'expense' as const,
  amount: 37000,
  date: Date.now(),
  accountId: 'acc-1',
  categoryId: 'cat-1',
  note: 'Belanja Mingguan',
  referenceKey: 'tiktok#578129381293812',
  items: [validItem],
  createdBy: validCreator,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
const parsedTx = transactionSchema.parse(txWithMeta);
assert(parsedTx.referenceKey === 'tiktok#578129381293812', 'parses referenceKey');
assert(parsedTx.items?.length === 1, 'parses items');
assert(parsedTx.createdBy?.name === 'Sarah', 'parses createdBy');

console.log('Schemas assert checks pass');
