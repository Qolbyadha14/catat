import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface UpdateCategoryInput {
  name?: string;
  icon?: string;
  isArchived?: boolean;
}

export function sanitizeCategoryUpdate(input: Record<string, unknown>): UpdateCategoryInput {
  const sanitized: UpdateCategoryInput = {};

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

export async function updateCategory(
  uid: string,
  categoryId: string,
  input: Record<string, unknown>
): Promise<UpdateCategoryInput> {
  const payload = sanitizeCategoryUpdate(input);
  const ref = doc(db, 'users', uid, 'categories', categoryId);
  await updateDoc(ref, payload);
  return payload;
}
