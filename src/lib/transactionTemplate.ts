export interface TransactionTemplate {
  id: string;
  tipe: 'expense' | 'income' | 'transfer';
  jumlah: number;
  kategori: string;
  akun: string;
  catatan: string;
  keAkun?: string;
  createdAt: number;
}

export const STORAGE_KEY = 'catat_templates';
export const MAX_TEMPLATES = 10;

export function loadTemplates(): TransactionTemplate[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t): t is TransactionTemplate =>
        Boolean(
          t &&
            typeof t === 'object' &&
            typeof t.id === 'string' &&
            (t.tipe === 'expense' || t.tipe === 'income' || t.tipe === 'transfer') &&
            typeof t.jumlah === 'number' &&
            t.jumlah > 0
        )
      )
      .slice(0, MAX_TEMPLATES);
  } catch {
    return [];
  }
}

export function saveTemplates(templates: TransactionTemplate[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates.slice(0, MAX_TEMPLATES)));
  } catch {
    // ponytail: ignore quota or security errors in incognito/restricted storage
  }
}

export function addTemplate(
  templates: TransactionTemplate[],
  entry: Omit<TransactionTemplate, 'id' | 'createdAt'>
): TransactionTemplate[] {
  const newTemplate: TransactionTemplate = {
    id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...entry,
    createdAt: Date.now(),
  };
  const updated = [newTemplate, ...templates.filter((t) => t.id !== newTemplate.id)].slice(0, MAX_TEMPLATES);
  saveTemplates(updated);
  return updated;
}

export function deleteTemplate(
  templates: TransactionTemplate[],
  id: string
): TransactionTemplate[] {
  const updated = templates.filter((t) => t.id !== id);
  saveTemplates(updated);
  return updated;
}

export function resolveTemplateFallback(
  template: TransactionTemplate,
  accounts: { id: string }[],
  categories: { id: string; type: string }[]
): {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  note: string;
} {
  const type = template.tipe;
  const amount = template.jumlah;
  const note = template.catatan ?? '';

  const accountId = accounts.some((a) => a.id === template.akun)
    ? template.akun
    : accounts[0]?.id ?? '';

  const toAccountOptions = accounts.filter((a) => a.id !== accountId);
  const toAccountId =
    template.keAkun && toAccountOptions.some((a) => a.id === template.keAkun)
      ? template.keAkun
      : toAccountOptions[0]?.id ?? '';

  const filteredCategories = categories.filter((c) => c.type === type);
  const isCategoryValid = filteredCategories.some((c) => c.id === template.kategori);
  const categoryId = isCategoryValid
    ? template.kategori
    : filteredCategories[0]?.id ?? '';

  return {
    type,
    amount,
    accountId,
    toAccountId,
    categoryId,
    note,
  };
}
