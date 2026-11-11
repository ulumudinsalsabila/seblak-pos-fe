"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageMinus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { FormInput, FormTextarea, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import type { InventoryItem, InventoryUnit, StockAdjustment, StockAdjustmentKind, StockAdjustmentReason, StockLocation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { adjustmentReasonLabel, dateTime, Feedback, PageResult, Pager, quantity, receivingUnits, signedRupiah, useDebounced } from "../inventory-ui";

type Line = { id: string; itemId: string; unitId: string; quantity: string; direction: "IN" | "OUT" };
const blankLine = (id: string): Line => ({ id, itemId: "", unitId: "", quantity: "", direction: "OUT" });

// Mirrors the reasons the API accepts per kind.
const reasons: Record<StockAdjustmentKind, StockAdjustmentReason[]> = {
  WASTE: ["EXPIRED", "SPOILED", "SPILLED", "DAMAGED", "STAFF_MEAL", "OTHER"],
  ADJUSTMENT: ["COUNT_CORRECTION", "FOUND", "DAMAGED", "OTHER"],
};
const kindLabel: Record<StockAdjustmentKind, string> = { WASTE: "Waste", ADJUSTMENT: "Penyesuaian" };
const directionOptions = [
  { value: "OUT", label: "Kurangi stok" },
  { value: "IN", label: "Tambah stok" },
];

export default function InventoryAdjustmentsPage() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<StockAdjustmentKind>("WASTE");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [locationId, setLocationId] = useState("");
  const [reason, setReason] = useState<StockAdjustmentReason | "">("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine("initial")]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);
  const locations = useQuery({ queryKey: ["inventory-locations", "adjustment"], queryFn: () => api<PageResult<StockLocation>>("/inventory/locations?page=1&limit=100&status=ACTIVE") });
  const items = useQuery({ queryKey: ["inventory-items", "adjustment"], queryFn: () => api<PageResult<InventoryItem>>("/inventory/items?page=1&limit=100&status=ACTIVE") });
  const units = useQuery({ queryKey: ["inventory-units", "adjustment"], queryFn: () => api<PageResult<InventoryUnit>>("/inventory/units?page=1&limit=100&status=ACTIVE") });
  const selectedItemIds = [...new Set(lines.map((line) => line.itemId).filter(Boolean))];
  const itemDetails = useQueries({ queries: selectedItemIds.map((id) => ({ queryKey: ["inventory-item", id], queryFn: () => api<{ data: InventoryItem }>(`/inventory/items/${id}`) })) });
  const history = useQuery({
    queryKey: ["inventory-adjustments", debouncedSearch, kindFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (kindFilter) params.set("kind", kindFilter);
      return api<PageResult<StockAdjustment>>(`/inventory/adjustments?${params}`);
    },
  });

  const itemDetail = (id: string) => itemDetails[selectedItemIds.indexOf(id)]?.data?.data;
  const unitsFor = (itemId: string) => receivingUnits(itemDetail(itemId), units.data?.data ?? []);
  const isWaste = kind === "WASTE";
  const notesRequired = !isWaste || reason === "OTHER";

  function update(id: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function switchKind(next: StockAdjustmentKind) {
    setKind(next);
    setReason("");
    setLines((current) => current.map((line) => ({ ...line, direction: "OUT" })));
    setError("");
    setMessage("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (new Set(lines.map((line) => line.itemId)).size !== lines.length) {
      setError("Item yang sama tidak boleh dicatat dua kali dalam satu dokumen.");
      return;
    }
    const verb = isWaste ? "waste ini" : "penyesuaian ini";
    if (!window.confirm(`Posting ${verb}? Stok langsung berubah dan tidak bisa dibatalkan.`)) return;
    setSubmitting(true);
    try {
      await api(isWaste ? "/inventory/waste" : "/inventory/adjustments", {
        method: "POST",
        body: JSON.stringify({
          clientRequestId: requestId,
          locationId,
          reason,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          lines: lines.map(({ itemId, unitId, quantity: lineQuantity, direction }) => ({
            itemId,
            unitId,
            quantity: lineQuantity,
            ...(isWaste ? {} : { direction }),
          })),
        }),
      });
      setRequestId(crypto.randomUUID());
      setReason("");
      setNotes("");
      setLines([blankLine(crypto.randomUUID())]);
      setPage(1);
      setMessage(isWaste ? "Waste berhasil diposting. Stok sudah dikurangi." : "Penyesuaian berhasil diposting. Stok sudah diperbarui.");
      await Promise.all(["inventory-adjustments", "inventory-overview", "inventory-balances", "inventory-movements"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memposting dokumen.");
    } finally {
      setSubmitting(false);
    }
  }

  if (locations.isLoading || items.isLoading || units.isLoading) return <Loading label="Menyiapkan master inventory..." />;
  if (locations.error) return <ErrorNotice error={locations.error} />;
  if (items.error) return <ErrorNotice error={items.error} />;
  if (units.error) return <ErrorNotice error={units.error} />;

  const locationOptions = (locations.data?.data ?? []).map((location) => ({ value: location.id, label: location.name, description: location.code }));
  const itemOptions = (items.data?.data ?? []).map((item) => ({ value: item.id, label: item.name, description: `${item.sku} · ${item.baseUnit.symbol}` }));
  const reasonOptions = reasons[kind].map((value) => ({ value, label: adjustmentReasonLabel[value] }));
  const ready = locationOptions.length > 0 && itemOptions.length > 0;
  const incomplete = !locationId || !reason || (notesRequired && !notes.trim()) || lines.some((line) => !line.itemId || !line.unitId || !line.quantity);

  return (
    <>
      <PageHeader title="Waste & penyesuaian" description="Catat bahan yang terbuang dan koreksi stok manual. Setiap dokumen wajib punya alasan dan tercatat atas nama petugas." />
      <Feedback message={message} error={error} />
      {!ready && <div className="card mb-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Buat minimal satu item dan satu lokasi aktif sebelum mencatat waste atau penyesuaian.</div>}
      <form className="card mb-8 p-4" onSubmit={submit}>
        <div className="mb-4 flex w-fit gap-1 rounded-xl border border-border bg-muted/40 p-1" role="tablist" aria-label="Jenis dokumen">
          {(["WASTE", "ADJUSTMENT"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={kind === value}
              className={cn("rounded-lg px-4 py-2 text-sm font-semibold transition-colors", kind === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
              onClick={() => switchKind(value)}
            >
              {kindLabel[value]}
            </button>
          ))}
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {isWaste ? "Waste selalu mengurangi stok dan dinilai dengan harga rata-rata saat ini." : "Penyesuaian bisa menambah atau mengurangi stok. Stok yang ditambahkan masuk dengan harga rata-rata saat ini. Catatan wajib diisi."}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <SearchSelect label="Lokasi" value={locationId} options={locationOptions} onChange={setLocationId} />
          <SearchSelect label="Alasan" value={reason} options={reasonOptions} onChange={(value) => setReason(value as StockAdjustmentReason)} />
        </div>
        <div className="mt-4">
          <FormTextarea label={notesRequired ? "Catatan (wajib)" : "Catatan"} rows={2} maxLength={500} placeholder={isWaste ? "Contoh: cabai busuk setelah libur" : "Jelaskan kenapa stok perlu dikoreksi"} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        <div className="mt-4 space-y-3">
          {lines.map((line, index) => {
            const unitOptions = unitsFor(line.itemId).map((unit) => ({ value: unit.id, label: unit.name, description: unit.symbol }));
            return (
              <div className={cn("grid gap-3 rounded-xl border border-border p-3 md:grid-cols-2", isWaste ? "xl:grid-cols-[1.4fr_1fr_150px_auto]" : "xl:grid-cols-[1.4fr_1fr_150px_170px_auto]")} key={line.id}>
                <SearchSelect label={`Item ${index + 1}`} value={line.itemId} options={itemOptions} onChange={(value) => update(line.id, { itemId: value, unitId: "" })} />
                <SearchSelect label="Satuan" value={line.unitId} options={unitOptions} disabled={!line.itemId} placeholder={line.itemId && !unitOptions.length ? "Memuat satuan..." : "Pilih satuan..."} onChange={(value) => update(line.id, { unitId: value })} />
                <FormInput label="Jumlah" required inputMode="decimal" placeholder="0" value={line.quantity} onChange={(event) => update(line.id, { quantity: event.target.value })} />
                {!isWaste && <SearchSelect label="Arah" value={line.direction} options={directionOptions} onChange={(value) => update(line.id, { direction: value as Line["direction"] })} />}
                <button type="button" aria-label="Hapus baris" className="btn-ghost self-end !min-h-11 !px-3 text-red-600" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Trash2 size={16} /></button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn-ghost" onClick={() => setLines((current) => [...current, blankLine(crypto.randomUUID())])}><Plus size={17} /> Tambah item</button>
          <button className="btn-primary" disabled={!ready || submitting || incomplete}><PackageMinus size={17} /> {submitting ? "Memposting..." : `Posting ${kindLabel[kind].toLowerCase()}`}</button>
        </div>
      </form>

      <h2 className="mb-3 text-lg font-black">Riwayat</h2>
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="field max-w-xl flex-1" placeholder="Cari catatan atau item..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <SearchSelect className="w-56" value={kindFilter} clearable placeholder="Semua jenis" options={(["WASTE", "ADJUSTMENT"] as const).map((value) => ({ value, label: kindLabel[value] }))} onChange={(value) => { setKindFilter(value); setPage(1); }} />
      </div>
      {history.isLoading && <Loading label="Memuat riwayat..." />}
      {history.error && <ErrorNotice error={history.error} />}
      {!history.isLoading && !history.data?.data.length && <Empty>Belum ada waste atau penyesuaian.</Empty>}
      {!!history.data?.data.length && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-4">WAKTU</th><th className="p-4">JENIS & ALASAN</th><th className="p-4">LOKASI</th><th className="p-4">ITEM</th><th className="p-4 text-right">NILAI</th><th className="p-4">PETUGAS</th></tr></thead>
            <tbody>
              {history.data.data.map((adjustment) => (
                <tr className="border-b border-border align-top" key={adjustment.id}>
                  <td className="whitespace-nowrap p-4">{dateTime(adjustment.occurredAt)}</td>
                  <td className="p-4"><p className="font-bold">{kindLabel[adjustment.kind]} · {adjustmentReasonLabel[adjustment.reason]}</p><p className="text-xs text-muted-foreground">{adjustment.notes ?? "—"}</p></td>
                  <td className="p-4">{adjustment.location.name}</td>
                  <td className="p-4">{adjustment.lines.map((line) => <p key={line.id}>{line.direction === "IN" ? "+" : "−"}{quantity(line.inputQuantity, 6)} {line.unit.symbol} {line.item.name}</p>)}</td>
                  <td className="p-4 text-right font-bold">{adjustment.totalAmount == null ? "—" : signedRupiah(adjustment.totalAmount, rupiah)}</td>
                  <td className="p-4">{adjustment.createdBy?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {history.data?.meta && <Pager page={history.data.meta.page} totalPages={history.data.meta.totalPages} disabled={history.isFetching} onChange={setPage} />}
    </>
  );
}
