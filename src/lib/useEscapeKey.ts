import { useEffect, useRef } from 'react';

/**
 * Menutup sheet atau modal dengan tombol Escape selama `active` bernilai true.
 * Handler disimpan di ref agar listener tidak dipasang ulang di setiap render.
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
  const handlerRef = useRef(onEscape);

  useEffect(() => {
    handlerRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handlerRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active]);
}
