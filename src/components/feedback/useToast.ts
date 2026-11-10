import { useContext } from 'react';
import { ToastContext, type ShowToast } from './toastContext';

// Tanpa provider (misalnya di test), pesan tetap terlihat di console alih-alih hilang diam-diam
const fallbackToast: ShowToast = (message) => {
  console.warn('[toast]', message);
};

export function useToast(): ShowToast {
  return useContext(ToastContext) ?? fallbackToast;
}
