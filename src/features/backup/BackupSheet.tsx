import { useRef, useState } from 'react';
import { useToast } from '../../components/feedback/useToast';
import { downloadTextFile } from '../../lib/downloadFile';
import type { Creator } from '../../lib/schemas';
import {
  MOCK_SHOWCASE_ACCOUNTS,
  MOCK_SHOWCASE_CATEGORIES,
  MOCK_SHOWCASE_TRANSACTIONS,
  isShowcaseMode,
} from '../../lib/showcaseMockData';
import { useEscapeKey } from '../../lib/useEscapeKey';
import { backupFileName, buildBackup, parseBackup, type Backup } from './backupFormat';
import { applyRestorePlan, exportBackup, loadExistingIds, type ApplyProgress } from './backupService';
import { isPlanEmpty, planRestore, type RestorePlan } from './restorePlan';

/** File backup tidak mungkin sebesar ini; menolak lebih awal mencegah tab membeku saat membaca. */
const MAX_FILE_BYTES = 100 * 1024 * 1024;

interface BackupSheetProps {
  uid: string;
  ledgerId?: string;
  /** Nama buku kas yang sedang aktif, untuk label di file dan di layar. */
  scopeName: string;
  me: Creator;
  onClose: () => void;
}

type RestoreState =
  | { step: 'idle' }
  | { step: 'reading' }
  | { step: 'preview'; fileName: string; plan: RestorePlan }
  | { step: 'applying'; progress: ApplyProgress }
  | { step: 'done'; plan: RestorePlan }
  | { step: 'error'; message: string };

const plural = (n: number) => n.toLocaleString('id-ID');

export function BackupSheet({ uid, ledgerId, scopeName, me, onClose }: BackupSheetProps) {
  const showToast = useToast();
  const showcase = isShowcaseMode();
  const fileInput = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [restore, setRestore] = useState<RestoreState>({ step: 'idle' });

  const busy = exporting || restore.step === 'reading' || restore.step === 'applying';
  useEscapeKey(!busy, onClose);

  const handleExport = async () => {
    setExporting(true);
    setExportNote(null);
    try {
      let backup: Backup;
      let skippedInvalid = 0;
      if (showcase) {
        backup = buildBackup({
          scope: 'personal',
          scopeName,
          accounts: MOCK_SHOWCASE_ACCOUNTS,
          categories: MOCK_SHOWCASE_CATEGORIES,
          transactions: MOCK_SHOWCASE_TRANSACTIONS,
        });
      } else {
        ({ backup, skippedInvalid } = await exportBackup(uid, { ledgerId, name: scopeName }));
      }
      downloadTextFile(backupFileName(), JSON.stringify(backup, null, 2));
      setExportNote(
        `${plural(backup.transactions.length)} transaksi, ${plural(backup.accounts.length)} akun, ${plural(
          backup.categories.length
        )} kategori tersimpan.` +
          (skippedInvalid > 0 ? ` ${plural(skippedInvalid)} data rusak tidak ikut dicadangkan.` : '')
      );
      showToast('Backup berhasil diunduh', { variant: 'success' });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Backup gagal. Coba lagi.', { variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setRestore({ step: 'error', message: 'File terlalu besar untuk dipulihkan.' });
      return;
    }
    setRestore({ step: 'reading' });
    try {
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        setRestore({ step: 'error', message: parsed.error });
        return;
      }
      const existing = await loadExistingIds(uid, ledgerId);
      setRestore({ step: 'preview', fileName: file.name, plan: planRestore(parsed.backup, existing, me) });
    } catch (err) {
      setRestore({ step: 'error', message: err instanceof Error ? err.message : 'File tidak bisa dibaca.' });
    }
  };

  const handleApply = async (plan: RestorePlan) => {
    setRestore({ step: 'applying', progress: { written: 0, total: 1 } });
    try {
      await applyRestorePlan(uid, ledgerId, plan, {
        onProgress: (progress) => setRestore({ step: 'applying', progress }),
      });
      setRestore({ step: 'done', plan });
      showToast('Pemulihan selesai', { variant: 'success' });
    } catch (err) {
      setRestore({
        step: 'error',
        message:
          (err instanceof Error ? err.message : 'Pemulihan gagal.') +
          ' Sebagian data mungkin sudah masuk. Pilih file yang sama lagi untuk melanjutkan; data yang sudah ada tidak akan dobel.',
      });
    }
  };

  const resetRestore = () => {
    setRestore({ step: 'idle' });
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <div className="sheet-backdrop" onClick={busy ? undefined : onClose}>
      <div
        className="bottom-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="backup-sheet-title"
      >
        <div className="sheet-handle-bar">
          <div className="sheet-handle" />
        </div>
        <div className="sheet-header">
          <h3 id="backup-sheet-title">Backup & Pulihkan</h3>
          <button
            type="button"
            className="btn-close-sheet"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup"
            title="Tutup"
          >
            ✕
          </button>
        </div>

        <div className="sheet-scroll-body gap-5">
          <section className="flex flex-col gap-2" aria-labelledby="backup-export-title">
            <h4 id="backup-export-title" className="text-sm font-semibold text-strong">
              Simpan cadangan
            </h4>
            <p className="text-xs text-subtle">
              Mengunduh semua transaksi, akun, dan kategori di <strong>{scopeName}</strong> sebagai satu file JSON.
              File ini tidak dienkripsi, jadi simpan di tempat yang aman.
            </p>
            <button type="button" className="btn btn-primary" onClick={handleExport} disabled={busy}>
              {exporting ? 'Menyiapkan…' : 'Unduh backup'}
            </button>
            <p className="text-xs text-subtle" role="status" aria-live="polite">
              {exportNote}
            </p>
          </section>

          <section className="flex flex-col gap-2" aria-labelledby="backup-restore-title">
            <h4 id="backup-restore-title" className="text-sm font-semibold text-strong">
              Pulihkan dari file
            </h4>
            <p className="text-xs text-subtle">
              Hanya menambahkan data yang belum ada di <strong>{scopeName}</strong>. Data yang sudah ada tidak
              ditimpa, dan memulihkan file yang sama dua kali tidak membuat data dobel.
            </p>

            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />

            {showcase && (
              <p className="text-xs text-subtle">Pemulihan tidak tersedia di mode demo.</p>
            )}

            {(restore.step === 'idle' || restore.step === 'error') && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInput.current?.click()}
                disabled={showcase}
              >
                Pilih file backup
              </button>
            )}

            <div role="status" aria-live="polite" className="text-xs text-subtle">
              {restore.step === 'reading' && 'Membaca file dan memeriksa data yang sudah ada…'}
              {restore.step === 'applying' &&
                `Memulihkan… ${plural(restore.progress.written)} dari ${plural(restore.progress.total)}`}
            </div>

            {restore.step === 'error' && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {restore.message}
              </p>
            )}

            {restore.step === 'preview' && (
              <PlanSummary
                title={restore.fileName}
                plan={restore.plan}
                action={
                  isPlanEmpty(restore.plan) ? (
                    <button type="button" className="btn btn-secondary" onClick={resetRestore}>
                      Pilih file lain
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-secondary flex-1" onClick={resetRestore}>
                        Batal
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary flex-1"
                        onClick={() => void handleApply(restore.plan)}
                      >
                        Pulihkan
                      </button>
                    </div>
                  )
                }
              />
            )}

            {restore.step === 'done' && (
              <PlanSummary
                title="Pemulihan selesai"
                plan={restore.plan}
                done
                action={
                  <button type="button" className="btn btn-primary" onClick={onClose}>
                    Selesai
                  </button>
                }
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function PlanSummary({
  title,
  plan,
  done = false,
  action,
}: {
  title: string;
  plan: RestorePlan;
  done?: boolean;
  action: React.ReactNode;
}) {
  const { skipped } = plan;
  const skippedTotal = skipped.existing + skipped.missingRefs + skipped.invalid;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-soft p-3">
      <div className="text-xs font-semibold text-strong break-all">{title}</div>
      <ul className="text-xs text-subtle flex flex-col gap-1">
        <li>
          {done ? 'Ditambahkan' : 'Akan ditambahkan'}: {plural(plan.transactionsToCreate.length)} transaksi,{' '}
          {plural(plan.accountsToCreate.length)} akun, {plural(plan.categoriesToCreate.length)} kategori
        </li>
        {skippedTotal > 0 && (
          <li>
            Dilewati: {plural(skipped.existing)} sudah ada
            {skipped.missingRefs > 0 && `, ${plural(skipped.missingRefs)} akun atau kategorinya tidak ada`}
            {skipped.invalid > 0 && `, ${plural(skipped.invalid)} data rusak`}
          </li>
        )}
        {plan.reattributed > 0 && (
          <li>
            {plural(plan.reattributed)} transaksi milik orang lain akan tercatat atas nama kamu.
          </li>
        )}
        {!done && isPlanEmpty(plan) && <li>Tidak ada data baru untuk dipulihkan.</li>}
      </ul>
      {action}
    </div>
  );
}
