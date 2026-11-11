import { useEffect, useRef } from 'react';
import type { Transaction } from '../../lib/schemas';
import { formatIdr, formatDate } from '../../lib/formatters';

interface DeleteTransactionDialogProps {
  /** Transaksi yang akan dihapus; null berarti dialog tertutup. */
  transaction: Transaction | null;
  accountMap: Map<string, { name: string }>;
  categoryMap: Map<string, { name: string }>;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Konfirmasi hapus memakai <dialog> native: focus trap, Escape, dan backdrop dari browser. */
export function DeleteTransactionDialog({
  transaction,
  accountMap,
  categoryMap,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteTransactionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (transaction && !dialog.open) dialog.showModal();
    if (!transaction && dialog.open) dialog.close();
  }, [transaction]);

  const label = transaction
    ? transaction.type === 'transfer'
      ? `${accountMap.get(transaction.fromAccountId)?.name ?? 'Akun'} ➔ ${accountMap.get(transaction.toAccountId)?.name ?? 'Akun'}`
      : categoryMap.get(transaction.categoryId)?.name ?? 'Kategori'
    : '';

  return (
    <dialog
      ref={dialogRef}
      className="delete-dialog"
      aria-labelledby="delete-dialog-title"
      onCancel={(e) => {
        // Tutup lewat state agar dialog dan React tetap sinkron
        e.preventDefault();
        if (!isDeleting) onCancel();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current && !isDeleting) onCancel();
      }}
    >
      {transaction && (
        <div className="delete-dialog-content">
          <h3 id="delete-dialog-title" className="delete-dialog-title">Konfirmasi Hapus</h3>
          <p className="delete-dialog-desc">
            Hapus transaksi <strong>{formatIdr(transaction.amount)}</strong> ({label}, {formatDate(transaction.date)})?
          </p>
          {transaction.type === 'transfer' && (
            <div className="delete-dialog-warning">
              ⚠️ Transaksi transfer: kedua sisi transfer (rekening asal dan tujuan) akan ikut terhapus secara atomik dan saldo masing-masing dikembalikan.
            </div>
          )}
          <div className="delete-dialog-actions">
            <button
              type="button"
              className="btn-dialog-cancel"
              onClick={onCancel}
              disabled={isDeleting}
              autoFocus
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-dialog-delete"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
