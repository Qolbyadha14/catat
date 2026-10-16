import { doc, updateDoc, setDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Category } from '../../lib/schemas';

export interface UpdateCategoryInput {
  name?: string;
  icon?: string;
  isArchived?: boolean;
}

export interface CreateCategoryInput {
  name: string;
  type: 'income' | 'expense';
  icon?: string;
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

export async function createCategory(
  uid: string,
  input: CreateCategoryInput
): Promise<Category> {
  const colRef = collection(db, 'users', uid, 'categories');
  const newRef = doc(colRef);
  const now = Date.now();
  const cat: Category = {
    id: newRef.id,
    name: input.name.trim(),
    type: input.type,
    icon: input.icon?.trim() || undefined,
    isArchived: false,
    createdAt: now,
  };
  await setDoc(newRef, cat);
  return cat;
}
