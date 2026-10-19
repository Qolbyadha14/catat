import { doc, updateDoc, setDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Account } from '../../lib/schemas';

export interface UpdateAccountInput {
  name?: string;
  icon?: string;
  dueDay?: number;
  isArchived?: boolean;
}

export interface CreateAccountInput {
  name: string;
  kind?: 'asset' | 'liability';
  balance?: number;
  icon?: string;
  dueDay?: number;
}

export function sanitizeAccountUpdate(input: Record<string, unknown>): UpdateAccountInput {
  const sanitized: UpdateAccountInput = {};

  if (typeof input.name === 'string') {
    const trimmed = input.name.trim();
    if (trimmed.length > 0) sanitized.name = trimmed;
  }
  if (typeof input.icon === 'string') {
    sanitized.icon = input.icon;
  }
  if (typeof input.dueDay === 'number' && Number.isInteger(input.dueDay) && input.dueDay >= 1 && input.dueDay <= 31) {
    sanitized.dueDay = input.dueDay;
  }
  if (typeof input.isArchived === 'boolean') {
    sanitized.isArchived = input.isArchived;
  }

  return sanitized;
}

export async function updateAccount(
  uid: string,
  accountId: string,
  input: Record<string, unknown>
): Promise<UpdateAccountInput> {
  const payload = sanitizeAccountUpdate(input);
  const ref = doc(db, 'users', uid, 'accounts', accountId);
  await updateDoc(ref, payload);
  return payload;
}

export async function createAccount(
  uid: string,
  input: CreateAccountInput
): Promise<Account> {
  const colRef = collection(db, 'users', uid, 'accounts');
  const newRef = doc(colRef);
  const now = Date.now();
  const acc: Account = {
    id: newRef.id,
    name: input.name.trim(),
    kind: input.kind || 'asset',
    balance: input.balance || 0,
    icon: input.icon?.trim() || undefined,
    dueDay: typeof input.dueDay === 'number' && input.dueDay >= 1 && input.dueDay <= 31 ? input.dueDay : undefined,
    isArchived: false,
    createdAt: now,
  };
  await setDoc(newRef, acc);
  return acc;
}
