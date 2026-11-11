import { doc, updateDoc, setDoc, collection, deleteField } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { Category } from '../../lib/schemas';

export interface UpdateCategoryInput {
  name?: string;
  icon?: string;
  isArchived?: boolean;
  monthlyBudget?: number | null;
}

export interface CreateCategoryInput {
  name: string;
  type: 'income' | 'expense';
  icon?: string;
  monthlyBudget?: number;
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
  if (typeof input.monthlyBudget === 'number' && !isNaN(input.monthlyBudget) && input.monthlyBudget >= 0) {
    sanitized.monthlyBudget = Math.round(input.monthlyBudget);
  } else if (input.monthlyBudget === null) {
    sanitized.monthlyBudget = null;
  }

  return sanitized;
}

export async function updateCategory(
  uid: string,
  categoryId: string,
  input: Record<string, unknown>,
  ledgerId?: string
): Promise<UpdateCategoryInput> {
  const payload = sanitizeCategoryUpdate(input);
  const ref = ledgerId
    ? doc(db, 'ledgers', ledgerId, 'categories', categoryId)
    : doc(db, 'users', uid, 'categories', categoryId);
  // monthlyBudget null berarti "hapus anggaran". Menyimpan null membuat categorySchema gagal parse
  // dan kategori hilang dari aplikasi, jadi field-nya dihapus.
  const { monthlyBudget, ...rest } = payload;
  await updateDoc(ref, monthlyBudget === null ? { ...rest, monthlyBudget: deleteField() } : payload);
  return payload;
}

export async function createCategory(
  uid: string,
  input: CreateCategoryInput,
  ledgerId?: string
): Promise<Category> {
  const colRef = ledgerId
    ? collection(db, 'ledgers', ledgerId, 'categories')
    : collection(db, 'users', uid, 'categories');
  const newRef = doc(colRef);
  const now = Date.now();
  const cat: Category = {
    id: newRef.id,
    name: input.name.trim(),
    type: input.type,
    isArchived: false,
    createdAt: now,
  };
  // Firestore menolak nilai undefined, jadi field opsional hanya ditulis bila terisi
  const icon = input.icon?.trim();
  if (icon) cat.icon = icon;
  if (input.monthlyBudget && input.monthlyBudget > 0) cat.monthlyBudget = Math.round(input.monthlyBudget);
  await setDoc(newRef, cat);
  return cat;
}
