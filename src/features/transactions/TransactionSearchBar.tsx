import { useState, useEffect } from 'react';

export interface TransactionSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function TransactionSearchBar({
  value,
  onChange,
  debounceMs = 150,
  placeholder = 'Cari catatan, akun, atau kategori...',
  disabled = false,
  className = 'search-input',
}: TransactionSearchBarProps) {
  const [prevValue, setPrevValue] = useState(value);
  const [localValue, setLocalValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    setLocalValue(value);
  }

  useEffect(() => {
    if (localValue === value) return;
    const timer = setTimeout(() => {
      onChange(localValue);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [localValue, value, debounceMs, onChange]);

  return (
    <input
      type="search"
      placeholder={placeholder}
      className={className}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      disabled={disabled}
      aria-label="Cari catatan, akun, atau kategori"
    />
  );
}
