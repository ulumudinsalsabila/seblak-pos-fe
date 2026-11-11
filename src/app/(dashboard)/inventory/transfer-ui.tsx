"use client";

import { Plus, Trash2 } from "lucide-react";
import { FormInput, SearchSelect } from "@/components/form-controls";
import type { InventoryItem, StockRequestStatus, StockTransferStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ItemLine = { id: string; itemId: string; quantity: string };
export const blankItemLine = (): ItemLine => ({ id: crypto.randomUUID(), itemId: "", quantity: "" });

const badge = "inline-block rounded-full border px-2.5 py-1 text-xs font-bold";
const tone = {
  info: "border-sky-200 bg-sky-50 text-sky-700",
  wait: "border-amber-200 bg-amber-50 text-amber-800",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  off: "border-border bg-muted text-muted-foreground",
  bad: "border-red-200 bg-red-50 text-red-700",
};

export const requestStatusLabel: Record<StockRequestStatus, string> = {
  SUBMITTED: "Menunggu persetujuan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
  PARTIALLY_FULFILLED: "Terpenuhi sebagian",
  FULFILLED: "Terpenuhi",
};
const requestTone: Record<StockRequestStatus, string> = {
  SUBMITTED: tone.wait,
  APPROVED: tone.info,
  REJECTED: tone.bad,
  CANCELLED: tone.off,
  PARTIALLY_FULFILLED: tone.wait,
  FULFILLED: tone.done,
};

export const transferStatusLabel: Record<StockTransferStatus, string> = {
  APPROVED: "Siap dikirim",
  SHIPPED: "Dalam perjalanan",
  PARTIALLY_RECEIVED: "Diterima sebagian",
  RECEIVED: "Diterima",
  CANCELLED: "Dibatalkan",
};
const transferTone: Record<StockTransferStatus, string> = {
  APPROVED: tone.wait,
  SHIPPED: tone.info,
  PARTIALLY_RECEIVED: tone.wait,
  RECEIVED: tone.done,
  CANCELLED: tone.off,
};

export function RequestStatusBadge({ status }: { status: StockRequestStatus }) {
  return <span className={cn(badge, requestTone[status])}>{requestStatusLabel[status]}</span>;
}

export function TransferStatusBadge({ status }: { status: StockTransferStatus }) {
  return <span className={cn(badge, transferTone[status])}>{transferStatusLabel[status]}</span>;
}

/** Item + base-unit quantity rows for requests and transfers. */
export function ItemLinesEditor({ lines, items, onChange }: { lines: ItemLine[]; items: InventoryItem[]; onChange(lines: ItemLine[]): void }) {
  const options = items.map((item) => ({ value: item.id, label: item.name, description: `${item.sku} · ${item.baseUnit.symbol}` }));
  const unitOf = (id: string) => items.find((item) => item.id === id)?.baseUnit.symbol;
  const update = (id: string, patch: Partial<ItemLine>) => onChange(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_170px_auto]" key={line.id}>
          <SearchSelect label={`Item ${index + 1}`} value={line.itemId} options={options} onChange={(value) => update(line.id, { itemId: value })} />
          <FormInput label={`Jumlah${unitOf(line.itemId) ? ` (${unitOf(line.itemId)})` : " dasar"}`} required inputMode="decimal" value={line.quantity} onChange={(event) => update(line.id, { quantity: event.target.value })} />
          <button type="button" aria-label="Hapus baris" className="btn-ghost self-end !min-h-11 !px-3 text-red-600" disabled={lines.length === 1} onClick={() => onChange(lines.filter((item) => item.id !== line.id))}><Trash2 size={16} /></button>
        </div>
      ))}
      <button type="button" className="btn-ghost" onClick={() => onChange([...lines, blankItemLine()])}><Plus size={17} /> Tambah item</button>
    </div>
  );
}

export const linesIncomplete = (lines: ItemLine[]) => lines.some((line) => !line.itemId || !line.quantity);
export const linesDuplicated = (lines: ItemLine[]) => new Set(lines.map((line) => line.itemId)).size !== lines.length;
