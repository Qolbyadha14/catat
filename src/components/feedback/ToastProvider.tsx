import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastOptions, type ToastVariant } from './toastContext';

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

const MAX_VISIBLE = 3;
const DEFAULT_DURATION_MS = 4000;

// Teks putih di atas warna -700 lolos WCAG AA (>= 4.5:1) di kedua tema
const VARIANT_CLASSES: Record<ToastVariant, string> = {
  error: 'bg-rose-700 text-white',
  success: 'bg-emerald-700 text-white',
  info: 'bg-slate-900 text-white ring-1 ring-white/10',
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  error: '⚠️',
  success: '✓',
  info: 'ℹ️',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const showToast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      nextId.current += 1;
      const id = nextId.current;
      const variant = options.variant ?? 'error';
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, variant }]);
      timers.current.set(id, setTimeout(() => dismiss(id), options.durationMs ?? DEFAULT_DURATION_MS));
    },
    [dismiss]
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => activeTimers.forEach((timer) => clearTimeout(timer));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {/* Region tetap ada di DOM agar screen reader membacakan pesan yang masuk */}
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 bottom-24 z-[1200] flex flex-col items-center gap-2 px-4 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full max-w-sm rounded-2xl pl-4 pr-1 text-sm font-semibold shadow-lg flex items-center gap-3 ${VARIANT_CLASSES[toast.variant]}`}
          >
            <span aria-hidden="true">{VARIANT_ICONS[toast.variant]}</span>
            <span className="flex-1 py-3 leading-snug">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Tutup notifikasi"
              className="shrink-0 w-11 rounded-xl opacity-80 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
