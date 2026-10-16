import { useState } from 'react';
import type { Account, Category } from '../../lib/schemas';
import {
  loadTemplates,
  addTemplate,
  deleteTemplate,
  resolveTemplateFallback,
  type TransactionTemplate,
} from '../../lib/transactionTemplate';
import { formatIdr } from '../../lib/formatters';

interface TransactionTemplateBarProps {
  accounts: Account[];
  categories: Category[];
  currentForm: {
    type: 'expense' | 'income' | 'transfer';
    rawAmount: string;
    accountId: string;
    toAccountId?: string;
    categoryId: string;
    note: string;
  };
  onApply: (data: {
    type: 'expense' | 'income' | 'transfer';
    amount: number;
    accountId: string;
    toAccountId: string;
    categoryId: string;
    note: string;
  }) => void;
  onError?: (msg: string | null) => void;
}

export function TransactionTemplateBar({
  accounts,
  categories,
  currentForm,
  onApply,
  onError,
}: TransactionTemplateBarProps) {
  const [templates, setTemplates] = useState<TransactionTemplate[]>(() => loadTemplates());

  const handleSelectTemplate = (tpl: TransactionTemplate) => {
    const resolved = resolveTemplateFallback(tpl, accounts, categories);
    onApply(resolved);
    onError?.(null);
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteTemplate(templates, id);
    setTemplates(updated);
  };

  const handleSaveCurrentAsTemplate = () => {
    const amountNum = parseInt(currentForm.rawAmount, 10);
    if (!amountNum || amountNum <= 0) {
      onError?.('Masukkan nominal transaksi sebelum menyimpan template');
      return;
    }
    if (!currentForm.accountId) {
      onError?.('Pilih akun transaksi sebelum menyimpan template');
      return;
    }
    if (currentForm.type !== 'transfer' && !currentForm.categoryId) {
      onError?.('Pilih kategori transaksi sebelum menyimpan template');
      return;
    }

    const updated = addTemplate(templates, {
      tipe: currentForm.type,
      jumlah: amountNum,
      kategori: currentForm.type === 'transfer' ? '' : currentForm.categoryId,
      akun: currentForm.accountId,
      catatan: currentForm.note.trim(),
      keAkun: currentForm.type === 'transfer' ? currentForm.toAccountId : undefined,
    });
    setTemplates(updated);
    onError?.(null);
  };

  const getTemplateLabel = (tpl: TransactionTemplate) => {
    if (tpl.tipe === 'transfer') {
      return `Transfer · ${formatIdr(tpl.jumlah)}`;
    }
    const cat = categories.find((c) => c.id === tpl.kategori);
    const catLabel = cat ? `${cat.icon ? `${cat.icon} ` : ''}${cat.name}` : (tpl.catatan || 'Transaksi');
    return `${catLabel} · ${formatIdr(tpl.jumlah)}`;
  };

  return (
    <div className="template-chips-bar" aria-label="Template Transaksi">
      {templates.map((tpl) => (
        <button
          key={tpl.id}
          type="button"
          className="template-chip"
          onClick={() => handleSelectTemplate(tpl)}
        >
          <span>{getTemplateLabel(tpl)}</span>
          <span
            role="button"
            tabIndex={0}
            className="template-chip-del"
            aria-label="Hapus template"
            onClick={(e) => handleDeleteTemplate(tpl.id, e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleDeleteTemplate(tpl.id, e as unknown as React.MouseEvent);
              }
            }}
          >
            ✕
          </span>
        </button>
      ))}

      <button
        type="button"
        className="template-chip-save"
        onClick={handleSaveCurrentAsTemplate}
        title="Simpan input saat ini sebagai template"
      >
        <span>+ Simpan Template</span>
      </button>
    </div>
  );
}
