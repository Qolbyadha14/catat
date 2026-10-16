import { z } from 'zod';

export const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(40),
  kind: z.enum(['asset', 'liability']),
  balance: z.number().int(),
  icon: z.string().max(8).optional(),
  isArchived: z.boolean().default(false),
  createdAt: z.number().int(),
});

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(32),
  type: z.enum(['income', 'expense']),
  icon: z.string().max(8).optional(),
  isArchived: z.boolean().default(false),
  createdAt: z.number().int(),
});

const baseTx = z.object({
  id: z.string().min(1),
  amount: z.number().int().positive(),
  date: z.number().int(),
  note: z.string().trim().max(140).optional().default(''),
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
