"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { InputHTMLAttributes, TextareaHTMLAttributes, useMemo, useState } from "react";
import { clsx } from "clsx";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

export function FormInput({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      <span className="label">{label}</span>
      <input {...props} className={clsx("field", props.className)} />
    </label>
  );
}

export function FormTextarea({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label>
      <span className="label">{label}</span>
      <textarea {...props} className={clsx("field", props.className)} />
    </label>
  );
}

export function SearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder = "Pilih data...",
  searchPlaceholder = "Cari...",
  disabled,
  clearable = false,
  className,
}: {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange(value: string): void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""}`.toLowerCase().includes(keyword),
    );
  }, [options, search]);

  const control = (
    <div className={clsx("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        className="field flex items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={clsx("min-w-0 flex-1 truncate", !selected && "text-[#9b8d83]")}>
          {selected?.label ?? placeholder}
        </span>
        {clearable && selected ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Kosongkan pilihan"
            onClick={(event) => {
              event.stopPropagation();
              onChange("");
            }}
          >
            <X size={16} />
          </span>
        ) : (
          <ChevronDown size={17} />
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-2 w-full min-w-52 overflow-hidden rounded-xl border border-[#eadfd3] bg-white shadow-xl">
          <div className="relative border-b border-[#eadfd3] p-2">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#9b8d83]" size={16} />
            <input
              autoFocus
              className="field min-h-10 py-2 pl-9"
              value={search}
              placeholder={searchPlaceholder}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1" role="listbox">
            {filtered.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                key={option.value}
                className={clsx(
                  "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f2f6ff]",
                  option.value === value && "bg-[#eaf1ff] font-black text-[var(--brand)]",
                )}
                onClick={() => {
                  onChange(option.value);
                  setSearch("");
                  setOpen(false);
                }}
              >
                <span className="block">{option.label}</span>
                {option.description && <span className="block text-xs text-[#796c63]">{option.description}</span>}
              </button>
            ))}
            {!filtered.length && <p className="p-4 text-center text-sm text-[#796c63]">Data tidak ditemukan.</p>}
          </div>
        </div>
      )}
      {open && <button type="button" aria-label="Tutup pilihan" className="fixed inset-0 z-[-1] cursor-default" onClick={() => setOpen(false)} />}
    </div>
  );

  return label ? <label><span className="label">{label}</span>{control}</label> : control;
}
