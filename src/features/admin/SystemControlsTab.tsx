import React, { useState } from 'react';
import {
  Sliders,
  ShieldAlert,
  Save,
  CheckCircle,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import type { SystemConfig } from '../../lib/config/systemConfigService';
import { updateSystemConfig } from '../../lib/config/systemConfigService';

interface SystemControlsTabProps {
  config: SystemConfig;
  adminUid: string;
}

const AVAILABLE_GEMINI_MODELS = [
  { id: 'gemini-3.5-flash-lite', label: 'gemini-3.5-flash-lite (Default Cepat & Hemat)' },
  { id: 'gemini-3.5-flash', label: 'gemini-3.5-flash (Akurasi Tinggi)' },
  { id: 'gemini-1.5-flash', label: 'gemini-1.5-flash (Model Stabil Legacy)' },
];

export const SystemControlsTab: React.FC<SystemControlsTabProps> = ({ config, adminUid }) => {
  const [dailyLimit, setDailyLimit] = useState<number>(config.dailyOcrLimit || 20);
  const [defaultModel, setDefaultModel] = useState<string>(config.defaultOcrModel || 'gemini-3.5-flash-lite');
  const [fallbackModel, setFallbackModel] = useState<string>(config.fallbackOcrModel || 'gemini-3.5-flash');
  const [aiKillSwitch, setAiKillSwitch] = useState<boolean>(config.aiKillSwitch || false);

  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await updateSystemConfig(
        {
          dailyOcrLimit: Math.max(1, dailyLimit),
          defaultOcrModel: defaultModel,
          fallbackOcrModel: fallbackModel,
          aiKillSwitch,
        },
        adminUid
      );
      setSuccessMessage('Konfigurasi sistem berhasil diperbarui secara langsung!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setErrorMessage(`Gagal menyimpan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: AI Limits & Default Models */}
        <div className="p-5 rounded-2xl bg-stone-900/60 border border-stone-800 space-y-4">
          <div className="flex items-center gap-2 text-stone-100 font-bold text-sm">
            <Sliders size={18} className="text-emerald-400" />
            <span>Parameter Kuota & Model AI</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-stone-300">
              Batas Kuota Scan Harian per Pengguna
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              className="w-full px-3.5 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 focus:outline-none focus:border-emerald-500"
              required
            />
            <p className="text-[11px] text-stone-500">
              Batas maksimal scan struk belanja OCR per pengguna per hari (default: 20).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-300">Model Gemini Utama</label>
              <select
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {AVAILABLE_GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-300">Model Fallback</label>
              <select
                value={fallbackModel}
                onChange={(e) => setFallbackModel(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {AVAILABLE_GEMINI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Card 2: Emergency Kill Switch */}
        <div className="p-5 rounded-2xl bg-stone-900/60 border border-stone-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className={aiKillSwitch ? 'text-rose-500' : 'text-stone-400'} />
              <div>
                <div className="text-sm font-bold text-stone-100">Emergency AI Kill Switch</div>
                <div className="text-[11px] text-stone-400">
                  Matikan pemanggilan Google Gemini secara global di seluruh aplikasi.
                </div>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={aiKillSwitch}
                onChange={(e) => setAiKillSwitch(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {aiKillSwitch && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>
                <strong>Perhatian:</strong> AI Kill Switch sedang aktif! Scan struk dan asisten teks Gemini akan otomatis beralih ke parser lokal atau menampilkan pesan pemeliharaan.
              </span>
            </div>
          )}
        </div>

        {/* Metadata info */}
        <div className="text-[11px] text-stone-500 font-mono">
          Terakhir diubah: {config.updatedAt ? new Date(config.updatedAt).toLocaleString('id-ID') : '-'} oleh {config.updatedBy || '-'}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </div>
  );
};
