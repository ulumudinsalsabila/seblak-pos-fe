"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function SearchInput({
  value,
  onChange,
  placeholder = "Cari...",
  label = "Pencarian",
  debounceMs = 300,
}: {
  value: string;
  onChange(value: string): void;
  placeholder?: string;
  label?: string;
  debounceMs?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);
  // Adopt outside changes (e.g. a filter reset), but not the echo of our own
  // trimmed value: that would eat a trailing space while the user is typing.
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value !== draft.trim()) setDraft(value);
  }
  // Callers pass inline arrows; keep the latest one without restarting the timer.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    const next = draft.trim();
    if (next === value) return;
    const timer = window.setTimeout(() => onChangeRef.current(next), debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, draft, value]);
  return <div className="relative min-w-0">
    <Search aria-hidden size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
    <input aria-label={label} className="field !pl-10 !pr-10" value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)} />
    {draft && <button type="button" aria-label="Hapus pencarian" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[var(--muted-foreground)]" onClick={() => { setDraft(""); onChange(""); }}><X size={15} /></button>}
  </div>;
}

export function DataTablePagination({
  page,
  limit,
  total,
  totalPages,
  disabled = false,
  onPageChange,
  onLimitChange,
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Disable navigation while a page is loading. */
  disabled?: boolean;
  onPageChange(page: number): void;
  onLimitChange(limit: number): void;
}) {
  const pages = Math.max(totalPages, 1);
  // After deletions the current page can be past the end: step back to the last page.
  useEffect(() => {
    if (!disabled && page > pages) onPageChange(pages);
  }, [disabled, page, pages, onPageChange]);
  const start = total ? (page - 1) * limit + 1 : 0;
  const end = Math.min(page * limit, total);
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] p-4 text-sm">
    <span className="text-[var(--muted-foreground)]">{total ? `${start}–${end} dari ${total}` : "Tidak ada data"}</span>
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-[var(--muted-foreground)]"><span className="hidden sm:inline">Per halaman</span><select aria-label="Data per halaman" className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-2" value={limit} onChange={(event) => onLimitChange(Number(event.target.value))}>{[10, 20, 50, 100].map((value) => <option key={value}>{value}</option>)}</select></label>
      <button type="button" aria-label="Halaman sebelumnya" className="btn-ghost !px-3" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>Sebelumnya</button>
      <span className="min-w-16 text-center font-bold">{Math.min(page, pages)}/{pages}</span>
      <button type="button" aria-label="Halaman berikutnya" className="btn-ghost !px-3" disabled={disabled || page >= pages} onClick={() => onPageChange(page + 1)}>Berikutnya</button>
    </div>
  </div>;
}
