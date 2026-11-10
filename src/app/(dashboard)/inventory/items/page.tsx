"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, PackageSearch, Plus, Power, X } from "lucide-react";
import { useState } from "react";
import { FormInput, FormTextarea, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import type { InventoryItem, InventoryUnit } from "@/lib/types";
import { Feedback, itemTypeLabel, PageResult, Pager, quantity, useDebounced } from "../inventory-ui";

const itemTypes = Object.entries(itemTypeLabel).map(([value, label]) => ({ value, label }));
const conversionModes = [
  { value: "SAME_DIMENSION", label: "Dimensi sama" },
  { value: "PACKAGING", label: "Kemasan" },
  { value: "DENSITY", label: "Densitas massa-volume" },
];

export default function InventoryItemsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", sku: "", type: "INGREDIENT", baseUnitId: "", reorderPoint: "0" });
  const [conversion, setConversion] = useState({ unitId: "", mode: "SAME_DIMENSION", factorToBase: "1", density: "", notes: "" });
  const debouncedSearch = useDebounced(search);
  const items = useQuery({
    queryKey: ["inventory-items", debouncedSearch, type, status, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20", status });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (type) params.set("type", type);
      return api<PageResult<InventoryItem>>(`/inventory/items?${params}`);
    },
  });
  const units = useQuery({
    queryKey: ["inventory-units", "all"],
    queryFn: () => api<PageResult<InventoryUnit>>("/inventory/units?page=1&limit=100&status=ACTIVE"),
  });
  const detail = useQuery({
    queryKey: ["inventory-item", selectedId],
    queryFn: () => api<{ data: InventoryItem }>(`/inventory/items/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  async function createItem(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api("/inventory/items", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", sku: "", type: "INGREDIENT", baseUnitId: "", reorderPoint: "0" });
      setShowForm(false);
      setMessage("Item inventory berhasil ditambahkan.");
      await queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan item.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(item: InventoryItem) {
    setError("");
    try {
      await api(`/inventory/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !item.isActive }) });
      setMessage(`Item ${item.isActive ? "dinonaktifkan" : "diaktifkan"}.`);
      await queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengubah item.");
    }
  }

  async function addConversion(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    setSubmitting(true);
    setError("");
    try {
      await api(`/inventory/items/${selectedId}/conversions`, {
        method: "POST",
        body: JSON.stringify({
          unitId: conversion.unitId,
          mode: conversion.mode,
          factorToBase: conversion.factorToBase,
          ...(conversion.density ? { density: conversion.density } : {}),
          ...(conversion.notes ? { notes: conversion.notes } : {}),
        }),
      });
      setConversion({ unitId: "", mode: "SAME_DIMENSION", factorToBase: "1", density: "", notes: "" });
      setMessage("Konversi satuan berhasil ditambahkan.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory-item", selectedId] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-items"] }),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan konversi.");
    } finally {
      setSubmitting(false);
    }
  }

  const unitOptions = (units.data?.data ?? []).map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.symbol})`, description: unit.dimension }));
  const baseUnitOptions = (units.data?.data ?? []).filter((unit) => unit.isBase).map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.symbol})`, description: unit.dimension }));

  return (
    <>
      <PageHeader title="Item inventory" description="Master bahan baku, barang setengah jadi, dan barang kemasan." action={<button className="btn-primary" onClick={() => setShowForm((value) => !value)}><Plus size={17} /> Tambah item</button>} />
      <Feedback message={message} error={error} />
      {showForm && <form className="card mb-6 grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={createItem}><FormInput label="Nama item" required placeholder="Kerupuk mentah" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><FormInput label="SKU" required placeholder="BB-KERUPUK" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /><SearchSelect label="Jenis item" value={form.type} options={itemTypes} onChange={(value) => setForm({ ...form, type: value })} /><SearchSelect label="Satuan dasar" value={form.baseUnitId} placeholder="Pilih satuan dasar..." options={baseUnitOptions} onChange={(value) => setForm({ ...form, baseUnitId: value })} /><FormInput label="Batas stok minimum" required inputMode="decimal" value={form.reorderPoint} onChange={(event) => setForm({ ...form, reorderPoint: event.target.value })} /><div className="flex items-end gap-2"><button className="btn-primary" disabled={submitting || !form.baseUnitId}>{submitting ? "Menyimpan..." : "Simpan item"}</button><button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Batal</button></div></form>}
      <div className="mb-4 grid gap-3 md:grid-cols-3"><input className="field" placeholder="Cari nama atau SKU..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /><SearchSelect value={type} clearable placeholder="Semua jenis item" options={itemTypes} onChange={(value) => { setType(value); setPage(1); }} /><SearchSelect value={status} options={[{ value: "ACTIVE", label: "Item aktif" }, { value: "INACTIVE", label: "Item nonaktif" }]} onChange={(value) => { setStatus(value); setPage(1); }} /></div>
      {items.isLoading && <Loading label="Memuat item inventory..." />}
      {items.error && <ErrorNotice error={items.error} />}
      {!items.isLoading && !items.data?.data.length && <Empty>Belum ada item inventory. Tambahkan item pertama untuk mulai mencatat stok.</Empty>}
      {!!items.data?.data.length && <div className="card overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-4">ITEM</th><th className="p-4">JENIS</th><th className="p-4">SATUAN DASAR</th><th className="p-4 text-right">REORDER</th><th className="p-4 text-center">KONVERSI</th><th className="p-4 text-right">AKSI</th></tr></thead><tbody>{items.data.data.map((item) => <tr className="border-b border-border" key={item.id}><td className="p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><PackageSearch size={17} /></span><div><p className="font-bold">{item.name}</p><p className="text-xs text-muted-foreground">{item.sku}</p></div></div></td><td className="p-4">{itemTypeLabel[item.type]}</td><td className="p-4">{item.baseUnit.name} ({item.baseUnit.symbol})</td><td className="p-4 text-right">{quantity(item.reorderPoint, item.baseUnit.precision)}</td><td className="p-4 text-center">{item._count?.conversions ?? 0}</td><td className="p-4"><div className="flex justify-end gap-2"><button className="btn-ghost !min-h-9 !px-3" onClick={() => setSelectedId(item.id)}><ArrowRightLeft size={15} /> Konversi</button><button className="btn-ghost !min-h-9 !px-3" onClick={() => void toggle(item)}><Power size={15} /> {item.isActive ? "Aktif" : "Nonaktif"}</button></div></td></tr>)}</tbody></table></div>}
      {items.data?.meta && <Pager page={items.data.meta.page} totalPages={items.data.meta.totalPages} disabled={items.isFetching} onChange={setPage} />}

      {selectedId && <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedId(null); }}><aside className="h-full w-full max-w-xl overflow-y-auto bg-background p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Konversi satuan</p><h2 className="mt-1 text-xl font-black">{detail.data?.data.name ?? "Memuat item..."}</h2></div><button className="btn-ghost !min-h-9 !px-3" onClick={() => setSelectedId(null)}><X size={17} /></button></div>{detail.isLoading && <Loading />}{detail.error && <ErrorNotice error={detail.error} />}{detail.data && <><div className="mt-5 space-y-2">{(detail.data.data.conversions ?? []).map((item) => <div className="rounded-xl border border-border p-3" key={item.id}><div className="flex justify-between gap-3"><p className="font-bold">{item.unit.name} ({item.unit.symbol})</p><span className="badge bg-muted">{item.mode}</span></div><p className="mt-1 text-sm text-muted-foreground">1 {item.unit.symbol} = {quantity(item.factorToBase, 9)} {detail.data.data.baseUnit.symbol}</p>{item.notes && <p className="mt-2 text-xs text-muted-foreground">{item.notes}</p>}</div>)}{!detail.data.data.conversions?.length && <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Belum ada konversi tambahan.</p>}</div><form className="mt-6 space-y-4 border-t border-border pt-5" onSubmit={addConversion}><h3 className="font-bold">Tambah atau revisi konversi</h3><SearchSelect label="Satuan" value={conversion.unitId} options={unitOptions.filter((unit) => unit.value !== detail.data.data.baseUnit.id)} onChange={(value) => setConversion({ ...conversion, unitId: value })} /><SearchSelect label="Mode konversi" value={conversion.mode} options={conversionModes} onChange={(value) => setConversion({ ...conversion, mode: value })} /><FormInput label={`Faktor ke ${detail.data.data.baseUnit.symbol}`} required inputMode="decimal" value={conversion.factorToBase} onChange={(event) => setConversion({ ...conversion, factorToBase: event.target.value })} />{conversion.mode === "DENSITY" && <FormInput label="Densitas" required inputMode="decimal" value={conversion.density} onChange={(event) => setConversion({ ...conversion, density: event.target.value })} />}<FormTextarea label="Catatan alasan konversi" required={conversion.mode !== "SAME_DIMENSION"} value={conversion.notes} onChange={(event) => setConversion({ ...conversion, notes: event.target.value })} /><button className="btn-primary w-full" disabled={submitting || !conversion.unitId}>{submitting ? "Menyimpan..." : "Simpan konversi"}</button></form></>}</aside></div>}
    </>
  );
}
