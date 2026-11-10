import { createContext } from 'react';

export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastOptions {
  variant?: ToastVariant;
  durationMs?: number;
}

export type ShowToast = (message: string, options?: ToastOptions) => void;

export const ToastContext = createContext<ShowToast | null>(null);
