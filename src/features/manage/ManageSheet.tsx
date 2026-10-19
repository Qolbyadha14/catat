import { useState, useMemo, type FormEvent } from 'react';
import type { Account, Category } from '../../lib/schemas';
import { canArchiveAccount } from '../../lib/canArchiveAccount';
import { isNameUnique } from '../../lib/manageValidation';
import { updateAccount, createAccount } from '../accounts/accountService';
import { updateCategory, createCategory } from '../categories/categoryService';
import { formatIdr } from '../../lib/formatters';

interface ManageSheetProps {
  uid: string;
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
}

type TabType = 'accounts' | 'categories';

const ACCOUNT_PRESETS: Array<{ name: string; icon: string; kind: 'asset' | 'liability' }> = [
  { name: 'BCA', icon: '🏦', kind: 'asset' },
  { name: 'Mandiri', icon: '🏦', kind: 'asset' },
  { name: 'BRI', icon: '🏦', kind: 'asset' },
  { name: 'Bank Jago', icon: '🏦', kind: 'asset' },
  { name: 'GoPay', icon: '📱', kind: 'asset' },
  { name: 'ShopeePay', icon: '📱', kind: 'asset' },
  { name: 'OVO', icon: '📱', kind: 'asset' },
  { name: 'DANA', icon: '📱', kind: 'asset' },
  { name: 'SPayLater', icon: '💳', kind: 'liability' },
  { name: 'GoPay Later', icon: '💳', kind: 'liability' },
  { name: 'Kredivo', icon: '💳', kind: 'liability' },
];

const CATEGORY_PRESETS: Array<{ name: string; icon: string; type: 'expense' | 'income' }> = [
  { name: 'Sembako & Dapur', icon: '🥦', type: 'expense' },
  { name: 'Pendidikan & Anak', icon: '📚', type: 'expense' },
  { name: 'Donasi & Sedekah', icon: '🤲', type: 'expense' },
  { name: 'Cicilan & Hutang', icon: '💳', type: 'expense' },
  { name: 'Usaha & Jualan', icon: '💼', type: 'income' },
  { name: 'Bonus & THR', icon: '🎁', type: 'income' },
  { name: 'Investasi & Bunga', icon: '📈', type: 'income' },
];

export function ManageSheet({
  uid,
  isOpen,
  onClose,
  accounts,
  categories,
}: ManageSheetProps) {
  const [activeTab, setActiveTab] = useState<TabType>('accounts');
  const [showArchived, setShowArchived] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form state
  const [editingItem, setEditingItem] = useState<Account | Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [kind, setKind] = useState<'asset' | 'liability'>('asset');
  const [categoryType, setCategoryType] = useState<'expense' | 'income'>('expense');
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeAccounts = useMemo(() => accounts.filter((a) => !a.isArchived), [accounts]);

  const displayedAccounts = useMemo(() => {
    return showArchived ? accounts : activeAccounts;
  }, [accounts, activeAccounts, showArchived]);

  const displayedCategories = useMemo(() => {
    return showArchived ? categories : categories.filter((c) => !c.isArchived);
  }, [categories, showArchived]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3500);
  };

  const handleStartEdit = (item: Account | Category) => {
    setIsCreating(false);
    setEditingItem(item);
    setName(item.name);
    setIcon(item.icon ?? '');
    if ('type' in item) {
      setCategoryType(item.type);
      setMonthlyBudgetInput(item.monthlyBudget ? new Intl.NumberFormat('id-ID').format(item.monthlyBudget) : '');
    } else {
      setMonthlyBudgetInput('');
    }
    setFormError(null);
  };

  const handleStartCreate = () => {
    setEditingItem(null);
    setIsCreating(true);
    setName('');
    setIcon('');
    setMonthlyBudgetInput('');
    setFormError(null);
  };

  const handleCancelForm = () => {
    setEditingItem(null);
    setIsCreating(false);
    setMonthlyBudgetInput('');
    setFormError(null);
  };

  const handleToggleArchiveAccount = async (acc: Account) => {
    if (!acc.isArchived) {
      const guard = canArchiveAccount(acc, activeAccounts);
      if (!guard.allowed) {
        showToast(guard.reason ?? 'Tidak dapat mengarsip akun');
        return;
      }
      try {
        await updateAccount(uid, acc.id, { isArchived: true });
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Gagal mengarsip akun');
      }
    } else {
      try {
        await updateAccount(uid, acc.id, { isArchived: false });
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Gagal membuka arsip akun');
      }
    }
  };

  const handleToggleArchiveCategory = async (cat: Category) => {
    try {
      await updateCategory(uid, cat.id, { isArchived: !cat.isArchived });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal mengubah arsip kategori');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Nama wajib diisi');
      return;
    }

    if (activeTab === 'accounts') {
      if (!isNameUnique(trimmedName, accounts, editingItem?.id)) {
        setFormError('Nama akun sudah digunakan');
        return;
      }

      setSaving(true);
      try {
        if (editingItem) {
          await updateAccount(uid, editingItem.id, {
            name: trimmedName,
            icon: icon.trim() || undefined,
          });
        } else {
          await createAccount(uid, {
            name: trimmedName,
            icon: icon.trim() || undefined,
            kind,
            balance: 0,
          });
        }
        handleCancelForm();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Gagal menyimpan');
      } finally {
        setSaving(false);
      }
    } else {
      if (!isNameUnique(trimmedName, categories, editingItem?.id)) {
        setFormError('Nama kategori sudah digunakan');
        return;
      }

      const rawBudget = monthlyBudgetInput.replace(/\D/g, '');
      const parsedBudget = rawBudget ? parseInt(rawBudget, 10) : undefined;

      setSaving(true);
      try {
        if (editingItem) {
          await updateCategory(uid, editingItem.id, {
            name: trimmedName,
            icon: icon.trim() || undefined,
            monthlyBudget: parsedBudget ?? null,
          });
        } else {
          await createCategory(uid, {
            name: trimmedName,
            icon: icon.trim() || undefined,
            type: categoryType,
            monthlyBudget: parsedBudget,
          });
        }
        handleCancelForm();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Gagal menyimpan');
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle-bar">
          <div className="sheet-handle" />
        </div>

        <div className="sheet-header">
          <h3>Kelola Akun & Kategori</h3>
          <button
            type="button"
            className="btn-close-sheet"
            onClick={onClose}
            aria-label="Tutup"
            title="Tutup kelola akun"
          >
            ✕
          </button>
        </div>

        {/* Inline Toast Notification */}
        {toastMessage && (
          <div className="manage-toast-banner" role="alert">
            <span>{toastMessage}</span>
            <button
              type="button"
              className="manage-toast-close"
              onClick={() => setToastMessage(null)}
              aria-label="Tutup pesan"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab Segmented Control */}
        <div className="manage-segmented-wrap">
          <div className="type-toggle-container">
            <button
              type="button"
              className={`type-toggle-btn ${activeTab === 'accounts' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('accounts');
                handleCancelForm();
              }}
            >
              Akun
            </button>
            <button
              type="button"
              className={`type-toggle-btn ${activeTab === 'categories' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('categories');
                handleCancelForm();
              }}
            >
              Kategori
            </button>
          </div>
        </div>

        <div className="sheet-scroll-body">
          {/* Create or Edit Form */}
          {editingItem || isCreating ? (
            <form onSubmit={handleSubmit} className="manage-edit-form">
              <div className="manage-form-title">
                {editingItem
                  ? `Edit ${activeTab === 'accounts' ? 'Akun' : 'Kategori'}`
                  : `Tambah ${activeTab === 'accounts' ? 'Akun' : 'Kategori'}`}
              </div>

              {isCreating && (
                <div className="manage-preset-group">
                  <div className="manage-preset-title">⚡ Rekomendasi Cepat (1-Klik Isi):</div>
                  <div className="manage-preset-scroller">
                    {activeTab === 'accounts'
                      ? ACCOUNT_PRESETS.map((p) => (
                          <button
                            key={p.name}
                            type="button"
                            className="manage-preset-chip"
                            onClick={() => {
                              setName(p.name);
                              setIcon(p.icon);
                              setKind(p.kind);
                            }}
                          >
                            <span>{p.icon}</span>
                            <span>{p.name}</span>
                          </button>
                        ))
                      : CATEGORY_PRESETS.map((p) => (
                          <button
                            key={p.name}
                            type="button"
                            className="manage-preset-chip"
                            onClick={() => {
                              setName(p.name);
                              setIcon(p.icon);
                              setCategoryType(p.type);
                            }}
                          >
                            <span>{p.icon}</span>
                            <span>{p.name}</span>
                          </button>
                        ))}
                  </div>
                </div>
              )}

              {formError && (
                <div className="form-error-banner" role="alert">
                  <span>{formError}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Nama</label>
                <input
                  type="text"
                  className="form-input"
                  maxLength={50}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Misal: Dompet Harian"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Icon / Emoji (Maks. 8 karakter)</label>
                <input
                  type="text"
                  className="form-input"
                  maxLength={8}
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  placeholder="Misal: 💳 atau 🍔"
                />
              </div>

              {/* If creating account: choose kind */}
              {isCreating && activeTab === 'accounts' && (
                <div className="form-group">
                  <label className="form-label">Tipe Akun</label>
                  <select
                    className="form-select"
                    value={kind}
                    onChange={(e) => {
                      const selected = e.target.value as 'asset' | 'liability';
                      setKind(selected);
                      if (selected === 'liability' && !icon) {
                        setIcon('💳');
                      }
                    }}
                  >
                    <option value="asset">🏦 Aset (Kas Tunai, Rekening Bank, Dompet Digital)</option>
                    <option value="liability">💳 PayLater & Tagihan (SPayLater, GoPay Later, Kredivo, dll)</option>
                  </select>
                  <span className="form-help-text" style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: 4, display: 'block' }}>
                    {kind === 'liability'
                      ? 'Pengeluaran via akun ini akan otomatis tercatat sebagai tagihan hutang yang harus dibayar.'
                      : 'Akun kas dan tabungan yang siap dibelanjakan.'}
                  </span>
                </div>
              )}

              {/* If creating category: choose type */}
              {isCreating && activeTab === 'categories' && (
                <div className="form-group">
                  <label className="form-label">Tipe Transaksi</label>
                  <select
                    className="form-select"
                    value={categoryType}
                    onChange={(e) => setCategoryType(e.target.value as 'expense' | 'income')}
                  >
                    <option value="expense">Pengeluaran</option>
                    <option value="income">Pemasukan</option>
                  </select>
                </div>
              )}

              {/* If category is expense: monthly budget target */}
              {activeTab === 'categories' &&
                ((isCreating && categoryType === 'expense') ||
                  (editingItem && 'type' in editingItem && editingItem.type === 'expense')) && (
                  <div className="form-group">
                    <label className="form-label">Target Anggaran Bulanan (Opsional)</label>
                    <div className="input-group">
                      <span className="input-prefix">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="form-input"
                        placeholder="0 (Tanpa batas)"
                        value={monthlyBudgetInput}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/\D/g, '');
                          setMonthlyBudgetInput(
                            raw ? new Intl.NumberFormat('id-ID').format(parseInt(raw, 10)) : ''
                          );
                        }}
                      />
                    </div>
                    <span className="form-help-text" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                      Batas pengeluaran per bulan untuk kalkulasi kuota belanja harian aman.
                    </span>
                  </div>
                )}

              {/* Read-only indicators when editing */}
              {editingItem && 'balance' in editingItem && (
                <div className="manage-readonly-row">
                  <span className="manage-readonly-label">Saldo:</span>
                  <span className="manage-readonly-val">{formatIdr(editingItem.balance)}</span>
                </div>
              )}

              <div className="manage-form-actions">
                <button
                  type="button"
                  className="btn-manage-cancel"
                  onClick={handleCancelForm}
                  disabled={saving}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-manage-save"
                  disabled={saving}
                >
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Add CTA */}
              <button
                type="button"
                className="btn-manage-add"
                onClick={handleStartCreate}
              >
                + Tambah {activeTab === 'accounts' ? 'Akun' : 'Kategori'}
              </button>

              {/* List items */}
              <div className="manage-list">
                {activeTab === 'accounts' ? (
                  displayedAccounts.length === 0 ? (
                    <div className="empty-state">Tidak ada akun</div>
                  ) : (
                    displayedAccounts.map((acc) => {
                      const archiveGuard = !acc.isArchived
                        ? canArchiveAccount(acc, activeAccounts)
                        : { allowed: true };

                      return (
                        <div
                          key={acc.id}
                          className={`manage-item-row ${acc.isArchived ? 'archived' : ''}`}
                        >
                          <button
                            type="button"
                            className="manage-item-info"
                            onClick={() => handleStartEdit(acc)}
                            title="Klik untuk edit nama atau icon"
                          >
                            <span className="manage-item-icon">{acc.icon || '🏦'}</span>
                            <div className="manage-item-text">
                              <span className="manage-item-name">{acc.name}</span>
                              <span className="manage-item-sub">
                                {acc.kind === 'liability' && acc.balance < 0
                                  ? `Tagihan: ${formatIdr(Math.abs(acc.balance))}`
                                  : formatIdr(acc.balance)}{' '}
                                • {acc.kind === 'asset' ? '🏦 Aset' : '💳 PayLater'}
                              </span>
                            </div>
                          </button>
                          <div className="manage-item-actions">
                            <button
                              type="button"
                              className={`manage-archive-btn ${acc.isArchived ? 'is-archived' : ''}`}
                              onClick={() => handleToggleArchiveAccount(acc)}
                              disabled={!archiveGuard.allowed && !acc.isArchived}
                              title={
                                acc.isArchived
                                  ? 'Buka arsip'
                                  : archiveGuard.allowed
                                  ? 'Arsipkan akun'
                                  : archiveGuard.reason
                              }
                              aria-label={acc.isArchived ? 'Buka arsip' : 'Arsipkan'}
                            >
                              {acc.isArchived ? '📥 Aktifkan' : '📦 Arsipkan'}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : displayedCategories.length === 0 ? (
                  <div className="empty-state">Tidak ada kategori</div>
                ) : (
                  displayedCategories.map((cat) => (
                    <div
                      key={cat.id}
                      className={`manage-item-row ${cat.isArchived ? 'archived' : ''}`}
                    >
                      <button
                        type="button"
                        className="manage-item-info"
                        onClick={() => handleStartEdit(cat)}
                        title="Klik untuk edit nama atau icon"
                      >
                        <span className="manage-item-icon">{cat.icon || '🏷️'}</span>
                        <div className="manage-item-text">
                          <span className="manage-item-name">{cat.name}</span>
                          <span className="manage-item-sub">
                            {cat.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                            {cat.monthlyBudget && cat.monthlyBudget > 0 && (
                              <span className="category-budget-pill"> • 🎯 {formatIdr(cat.monthlyBudget)}/bln</span>
                            )}
                          </span>
                        </div>
                      </button>
                      <div className="manage-item-actions">
                        <button
                          type="button"
                          className={`manage-archive-btn ${cat.isArchived ? 'is-archived' : ''}`}
                          onClick={() => handleToggleArchiveCategory(cat)}
                          title={cat.isArchived ? 'Buka arsip' : 'Arsipkan kategori'}
                          aria-label={cat.isArchived ? 'Buka arsip' : 'Arsipkan'}
                        >
                          {cat.isArchived ? '📥 Aktifkan' : '📦 Arsipkan'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Bottom Bar: Toggle show archived */}
        <div className="manage-bottom-bar">
          <label className="manage-toggle-label">
            <input
              type="checkbox"
              className="manage-toggle-checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            <span>Tampilkan item terarsip</span>
          </label>
        </div>
      </div>
    </div>
  );
}
