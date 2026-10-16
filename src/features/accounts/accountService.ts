import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface UpdateAccountInput {
  name?: string;
  icon?: string;
  isArchived?: boolean;
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
