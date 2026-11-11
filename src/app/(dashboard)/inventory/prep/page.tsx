"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Flame, Plus, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";
import { FormInput, FormTextarea, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import type { InventoryItem, PrepBatch, PrepBatchStatus, PrepRecipeItem, StockLocation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dateTime, Feedback, PageResult, Pager, quantity } from "../inventory-ui";

type Line = { id: string; itemId: string; quantity: string };
const blankLine = (): Line => ({ id: crypto.randomUUID(), itemId: "", quantity: "" });

const statusLabel: Record<PrepBatchStatus, string> = { IN_PROGRESS: "Diproses", COMPLETED: "Selesai", VOIDED: "Dibatalkan" };
const statusStyle: Record<PrepBatchStatus, string> = {
  IN_PROGRESS: "border-sky-200 bg-sky-50 text-sky-700",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  VOIDED: "border-border bg-muted text-muted-foreground",
};

/** Recipe quantity scaled to the planned output, as a plain decimal string. */
function scaled(recipeQuantity: string, planned: number, standard: number) {
  return String(Number(((Number(recipeQuantity) * planned) / standard).toFixed(6)));
}

export default function InventoryPrepPage() {
  const queryClient = useQueryClient();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [locationId, setLocationId] = useState("");
  const [outputItemId, setOutputItemId] = useState("");
  const [planned, setPlanned] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [openBatchId, setOpenBatchId] = useState("");
  const [actual, setActual] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [busy, setBusy] = useState("");
  const recipes = useQuery({ queryKey: ["inventory-prep-recipes"], queryFn: () => api<{ data: PrepRecipeItem[] }>("/inventory/prep-recipes") });
  const items = useQuery({ queryKey: ["inventory-items", "prep"], queryFn: () => api<PageResult<InventoryItem>>("/inventory/items?page=1&limit=100&status=ACTIVE") });
  const locations = useQuery({ queryKey: ["inventory-locations", "prep"], queryFn: () => api<PageResult<StockLocation>>("/inventory/locations?page=1&limit=100&status=ACTIVE") });
  const batches = useQuery({
    queryKey: ["inventory-prep-batches", status, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (status) params.set("status", status);
      return api<PageResult<PrepBatch>>(`/inventory/prep-batches?${params}`);
    },
  });

  const outputs = recipes.data?.data ?? [];
  const output = outputs.find((item) => item.id === outputItemId);

  /** Fills the inputs from the output's recipe, scaled to the planned quantity. */
  function fillFromRecipe(item: PrepRecipeItem | undefined, plannedValue: string) {
    if (!item?.recipe) return;
    const plannedNumber = Number(plannedValue) || Number(item.recipe.outputQuantity);
    if (!plannedValue) setPlanned(item.recipe.outputQuantity);
    setLines(item.recipe.lines.map((line) => ({ id: crypto.randomUUID(), itemId: line.item.id, quantity: scaled(line.quantity, plannedNumber, Number(item.recipe!.outputQuantity)) })));
  }

  async function refresh() {
    await Promise.all(["inventory-prep-batches", "inventory-overview", "inventory-balances", "inventory-movements", "inventory-adjustments"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  }

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!window.confirm("Mulai produksi? Bahan langsung dikeluarkan dari stok.")) return;
    setSubmitting(true);
    try {
      await api("/inventory/prep-batches", {
        method: "POST",
        body: JSON.stringify({ clientRequestId: requestId, locationId, outputItemId, plannedQuantity: planned, ...(notes.trim() ? { notes: notes.trim() } : {}), lines: lines.map(({ itemId, quantity: lineQuantity }) => ({ itemId, quantity: lineQuantity })) }),
      });
      setRequestId(crypto.randomUUID());
      setOutputItemId("");
      setPlanned("");
      setLines([blankLine()]);
      setNotes("");
      setPage(1);
      setMessage("Produksi dimulai. Bahan sudah dikeluarkan dari stok; catat hasil aktual setelah selesai.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memulai produksi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function act(batch: PrepBatch, action: "complete" | "RESTOCK" | "WASTE") {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      if (action === "complete") {
        await api(`/inventory/prep-batches/${batch.id}/complete`, { method: "POST", body: JSON.stringify({ actualQuantity: actual }) });
        setMessage(`Produksi ${batch.outputItem.name} selesai. Hasil masuk ke stok dengan HPP dari seluruh biaya bahan.`);
      } else {
        await api(`/inventory/prep-batches/${batch.id}/void`, { method: "POST", body: JSON.stringify({ reason: voidReason.trim(), disposition: action }) });
        setMessage(action === "RESTOCK" ? "Produksi dibatalkan. Bahan dikembalikan ke stok." : "Produksi dibatalkan. Bahan dicatat sebagai waste.");
      }
      setOpenBatchId("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aksi gagal.");
    } finally {
      setBusy("");
    }
  }

  if (recipes.isLoading || items.isLoading || locations.isLoading) return <Loading label="Memuat produksi..." />;
  if (recipes.error) return <ErrorNotice error={recipes.error} />;
  if (items.error) return <ErrorNotice error={items.error} />;
  if (locations.error) return <ErrorNotice error={locations.error} />;
  const locationOptions = (locations.data?.data ?? []).map((location) => ({ value: location.id, label: location.name, description: location.code }));
  const outputOptions = outputs.map((item) => ({ value: item.id, label: item.name, description: item.recipe ? `Resep: ${quantity(item.recipe.outputQuantity, item.baseUnit.precision)} ${item.baseUnit.symbol}` : "Belum ada resep" }));
  const inputOptions = (items.data?.data ?? []).filter((item) => item.id !== outputItemId).map((item) => ({ value: item.id, label: item.name, description: `${item.sku} · ${item.baseUnit.symbol}` }));
  const unitOf = (id: string) => items.data?.data.find((item) => item.id === id)?.baseUnit.symbol;
  const incomplete = !locationId || !outputItemId || !planned || lines.some((line) => !line.itemId || !line.quantity);

  return (
    <>
      <PageHeader title="Produksi" description="Olah bahan mentah menjadi bahan setengah jadi. Bahan keluar saat produksi dimulai; hasil aktual membawa seluruh biaya bahan, jadi susut langsung tercermin di HPP." />
      <Feedback message={message} error={error} />
      {!outputs.length && <div className="card mb-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Buat item bertipe barang setengah jadi terlebih dahulu.</div>}
      <form className="card mb-8 p-4" onSubmit={start}>
        <div className="grid gap-4 md:grid-cols-3">
          <SearchSelect label="Lokasi produksi" value={locationId} options={locationOptions} onChange={setLocationId} />
          <SearchSelect label="Hasil produksi" value={outputItemId} options={outputOptions} onChange={(value) => { setOutputItemId(value); fillFromRecipe(outputs.find((item) => item.id === value), planned); }} />
          <FormInput label={`Target hasil${output ? ` (${output.baseUnit.symbol})` : ""}`} required inputMode="decimal" placeholder="0" value={planned} onChange={(event) => setPlanned(event.target.value)} onBlur={() => fillFromRecipe(output, planned)} />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <h3 className="font-bold">Bahan yang dipakai</h3>
          <div className="flex gap-2">
            {output?.recipe && <button type="button" className="btn-ghost !min-h-9 !px-3" onClick={() => fillFromRecipe(output, planned)}>Isi dari resep</button>}
            <button type="button" className="btn-ghost !min-h-9 !px-3" onClick={() => setLines((current) => [...current, blankLine()])}><Plus size={15} /> Bahan</button>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {lines.map((line, index) => (
            <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_170px_auto]" key={line.id}>
              <SearchSelect label={`Bahan ${index + 1}`} value={line.itemId} options={inputOptions} onChange={(value) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, itemId: value } : item))} />
              <FormInput label={`Jumlah${unitOf(line.itemId) ? ` (${unitOf(line.itemId)})` : " dasar"}`} required inputMode="decimal" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: event.target.value } : item))} />
              <button type="button" aria-label="Hapus bahan" className="btn-ghost self-end !min-h-11 !px-3 text-red-600" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <div className="mt-4"><FormTextarea label="Catatan" rows={2} maxLength={500} placeholder="Opsional" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
        <div className="mt-4 flex justify-end"><button className="btn-primary" disabled={submitting || incomplete}><Flame size={17} /> {submitting ? "Memulai..." : "Mulai produksi"}</button></div>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black">Riwayat produksi</h2>
        <SearchSelect className="w-56" value={status} clearable placeholder="Semua status" options={Object.entries(statusLabel).map(([value, label]) => ({ value, label }))} onChange={(value) => { setStatus(value); setPage(1); }} />
      </div>
      {batches.isLoading && <Loading label="Memuat riwayat produksi..." />}
      {batches.error && <ErrorNotice error={batches.error} />}
      {!batches.isLoading && !batches.data?.data.length && <Empty>Belum ada produksi.</Empty>}
      {!!batches.data?.data.length && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-4">MULAI</th><th className="p-4">HASIL</th><th className="p-4">STATUS</th><th className="p-4 text-right">TARGET / AKTUAL</th><th className="p-4 text-right">YIELD</th><th className="p-4 text-right">HPP / UNIT</th><th className="p-4" /></tr></thead>
            <tbody>
              {batches.data.data.map((batch) => {
                const symbol = batch.outputItem.baseUnit.symbol;
                const yieldPercent = batch.actualQuantity ? (Number(batch.actualQuantity) / Number(batch.plannedQuantity)) * 100 : null;
                const isOpen = openBatchId === batch.id;
                return (
                  <Fragment key={batch.id}>
                    <tr className="border-b border-border align-top">
                      <td className="whitespace-nowrap p-4">{dateTime(batch.startedAt)}<p className="text-xs text-muted-foreground">{batch.startedBy?.name ?? "—"} · {batch.location.name}</p></td>
                      <td className="p-4"><p className="font-bold">{batch.outputItem.name}</p><p className="text-xs text-muted-foreground">{batch.inputs.map((input) => `${quantity(input.quantity, 6)} ${input.item.baseUnit.symbol} ${input.item.name}`).join(", ")}</p></td>
                      <td className="p-4"><span className={cn("inline-block rounded-full border px-2.5 py-1 text-xs font-bold", statusStyle[batch.status])}>{statusLabel[batch.status]}</span>{batch.voidReason && <p className="mt-1 text-xs text-muted-foreground">{batch.voidReason} · {batch.voidDisposition === "WASTE" ? "dicatat waste" : "bahan dikembalikan"}</p>}</td>
                      <td className="whitespace-nowrap p-4 text-right">{quantity(batch.plannedQuantity, 6)} / {batch.actualQuantity ? quantity(batch.actualQuantity, 6) : "—"} {symbol}</td>
                      <td className={cn("p-4 text-right font-bold", yieldPercent !== null && yieldPercent < 100 && "text-amber-700")}>{yieldPercent === null ? "—" : `${quantity(yieldPercent, 1)}%`}</td>
                      <td className="p-4 text-right">{batch.outputUnitCost == null ? "—" : `${rupiah(Number(batch.outputUnitCost))}/${symbol}`}</td>
                      <td className="p-4 text-right">{batch.status === "IN_PROGRESS" && <button type="button" className="btn-ghost !min-h-9 !px-3" onClick={() => { setOpenBatchId(isOpen ? "" : batch.id); setActual(""); setVoidReason(""); }}>{isOpen ? "Tutup" : "Selesaikan / batal"}</button>}</td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={7} className="p-4">
                          <div className="grid gap-6 lg:grid-cols-2">
                            <div className="flex flex-wrap items-end gap-3">
                              <FormInput label={`Hasil aktual (${symbol})`} inputMode="decimal" placeholder={batch.plannedQuantity} value={actual} onChange={(event) => setActual(event.target.value)} />
                              <button type="button" className="btn-primary" disabled={!actual || !!busy} onClick={() => act(batch, "complete")}><CheckCircle2 size={17} /> {busy === "complete" ? "Menyimpan..." : "Selesaikan"}</button>
                            </div>
                            <div className="flex flex-wrap items-end gap-3">
                              <FormInput label="Alasan batal" placeholder="Minimal 3 karakter" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />
                              <button type="button" className="btn-ghost" disabled={voidReason.trim().length < 3 || !!busy} onClick={() => act(batch, "RESTOCK")}>Batal, kembalikan bahan</button>
                              <button type="button" className="btn-ghost text-red-600" disabled={voidReason.trim().length < 3 || !!busy} onClick={() => act(batch, "WASTE")}>Batal, catat waste</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {batches.data?.meta && <Pager page={batches.data.meta.page} totalPages={batches.data.meta.totalPages} disabled={batches.isFetching} onChange={setPage} />}
    </>
  );
}
