import { z } from 'zod';

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  kind: z.enum(['asset', 'liability']),
  balance: z.number().int(),
  icon: z.string().max(8).optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  isArchived: z.boolean().default(false),
  createdAt: z.number().int(),
});

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(32),
  type: z.enum(['income', 'expense']),
  icon: z.string().max(8).optional(),
  monthlyBudget: z.number().int().nonnegative().optional(),
  isArchived: z.boolean().default(false),
  createdAt: z.number().int(),
});

export const creatorSchema = z.object({
  uid: z.string().min(1),
  name: z.string().trim().min(1).max(50),
  photoURL: z.string().url().optional(),
});

export const transactionItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  qty: z.number().positive().optional().default(1),
  price: z.number().int().nonnegative().optional(),
  subtotal: z.number().int().nonnegative().optional(),
});

export const ledgerMemberSchema = z.object({
  uid: z.string().min(1),
  name: z.string().trim().min(1).max(50),
  email: z.string().optional().default(''),
  photoURL: z.string().url().optional(),
  role: z.enum(['owner', 'member']),
  joinedAt: z.number().int(),
});

export const ledgerSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  ownerUid: z.string().min(1),
  inviteCode: z.string().trim().min(6).max(8),
  members: z.record(z.string(), ledgerMemberSchema),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

const baseTx = z.object({
  id: z.string().min(1),
  amount: z.number().int().positive(),
  date: z.number().int(),
  note: z.string().trim().max(140).optional().default(''),
  referenceKey: z.string().trim().max(120).nullable().optional(),
  items: z.array(transactionItemSchema).optional(),
  createdBy: creatorSchema.optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

export const transactionSchema = z.discriminatedUnion('type', [
  baseTx.extend({
    type: z.literal('income'),
    accountId: z.string().min(1),
    categoryId: z.string().min(1),
  }),
  baseTx.extend({
    type: z.literal('expense'),
    accountId: z.string().min(1),
    categoryId: z.string().min(1),
  }),
  baseTx.extend({
    type: z.literal('transfer'),
    fromAccountId: z.string().min(1),
    toAccountId: z.string().min(1),
  }).refine(t => t.fromAccountId !== t.toAccountId, { path: ['toAccountId'], message: 'Akun tujuan harus berbeda' }),
]);

export type Account = z.infer<typeof accountSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionCreator = z.infer<typeof creatorSchema>;
export type Creator = TransactionCreator;
export type TransactionItem = z.infer<typeof transactionItemSchema>;
export type LedgerMember = z.infer<typeof ledgerMemberSchema>;
export type Ledger = z.infer<typeof ledgerSchema>;
