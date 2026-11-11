"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ClipboardCheck, RotateCcw, Save, Send, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { FormInput, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import type { InventoryItem, InventoryUnit, Stocktake } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dateTime, Feedback, PageResult, quantity, receivingUnits, signedRupiah } from "../../inventory-ui";
import { StocktakeStatusBadge } from "../stocktake-ui";

export default function StocktakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [itemId, setItemId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [countQuantity, setCountQuantity] = useState("");
  const [countNotes, setCountNotes] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const stocktake = useQuery({ queryKey: ["inventory-stocktake", id], queryFn: () => api<{ data: Stocktake }>(`/inventory/stocktakes/${id}`) });
  const items = useQuery({ queryKey: ["inventory-items", "stocktake"], queryFn: () => api<PageResult<InventoryItem>>("/inventory/items?page=1&limit=100&status=ACTIVE") });
  const units = useQuery({ queryKey: ["inventory-units", "stocktake"], queryFn: () => api<PageResult<InventoryUnit>>("/inventory/units?page=1&limit=100&status=ACTIVE") });
  const itemDetail = useQuery({ queryKey: ["inventory-item", itemId], enabled: !!itemId, queryFn: () => api<{ data: InventoryItem }>(`/inventory/items/${itemId}`) });

  async function run(action: string, path: string, init: RequestInit, done: string) {
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const response = await api<{ data: Stocktake }>(path, init);
      queryClient.setQueryData(["inventory-stocktake", id], response);
      setMessage(done);
      await queryClient.invalidateQueries({ queryKey: ["inventory-stocktakes"] });
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aksi gagal.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function recordCount(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(
      "count",
      `/inventory/stocktakes/${id}/counts`,
      { method: "PUT", body: JSON.stringify({ lines: [{ itemId, unitId, quantity: countQuantity, ...(countNotes.trim() ? { notes: countNotes.trim() } : {}) }] }) },
      "Hitungan tersimpan.",
    );
    if (saved) {
      setItemId("");
      setUnitId("");
      setCountQuantity("");
      setCountNotes("");
    }
  }

  async function approve() {
    if (!window.confirm("Setujui dan posting opname ini? Selisih langsung masuk ke stok dan tidak bisa dibatalkan.")) return;
    const posted = await run("approve", `/inventory/stocktakes/${id}/approve`, { method: "POST" }, "Opname diposting. Selisih sudah masuk ke kartu stok.");
    if (posted) await Promise.all(["inventory-overview", "inventory-balances", "inventory-movements"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  }

  async function cancel() {
    const reason = window.prompt("Alasan pembatalan opname:");
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setError("Alasan pembatalan minimal 3 karakter.");
      return;
    }
    await run("cancel", `/inventory/stocktakes/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) }, "Opname dibatalkan. Stok tidak berubah.");
  }

  if (stocktake.isLoading || items.isLoading || units.isLoading) return <Loading label="Memuat stock opname..." />;
  if (stocktake.error) return <ErrorNotice error={stocktake.error} />;
  if (items.error) return <ErrorNotice error={items.error} />;
  if (units.error) return <ErrorNotice error={units.error} />;
  const data = stocktake.data!.data;
  const lines = data.lines ?? [];
  const counting = data.status === "COUNTING";
  const review = data.status === "REVIEW";
  const open = counting || review;
  const isOwner = user?.role === "OWNER";
  const itemOptions = (items.data?.data ?? []).map((item) => ({ value: item.id, label: item.name, description: `${item.sku} · ${item.baseUnit.symbol}${lines.some((line) => line.item.id === item.id) ? " · sudah dihitung" : ""}` }));
  const unitOptions = receivingUnits(itemDetail.data?.data, units.data?.data ?? []).map((unit) => ({ value: unit.id, label: unit.name, description: unit.symbol }));
  const varianceLines = lines.filter((line) => Number(line.varianceQuantity) !== 0);
  const postedTotal = data.status === "POSTED" && lines.every((line) => line.varianceAmount != null) ? lines.reduce((sum, line) => sum + Number(line.varianceAmount), 0) : null;

  return (
    <>
      <Link href="/inventory/stocktakes" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Semua opname</Link>
      <PageHeader title={`Stock opname · ${data.location.name}`} description={data.notes ?? "Hitung stok fisik, kirim untuk persetujuan, lalu posting selisihnya."} />
      <Feedback message={message} error={error} />

      <div className="card mb-6 grid gap-4 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Status</p><div className="mt-1"><StocktakeStatusBadge status={data.status} /></div></div>
        <div><p className="text-xs text-muted-foreground">Dibuat</p><p className="mt-1 font-semibold">{dateTime(data.createdAt)} · {data.createdBy?.name ?? "—"}</p></div>
        <div><p className="text-xs text-muted-foreground">Dikirim review</p><p className="mt-1 font-semibold">{data.submittedAt ? `${dateTime(data.submittedAt)} · ${data.submittedBy?.name ?? "—"}` : "—"}</p></div>
        <div>
          <p className="text-xs text-muted-foreground">{data.status === "CANCELLED" ? "Dibatalkan" : "Disetujui & diposting"}</p>
          <p className="mt-1 font-semibold">
            {data.status === "CANCELLED" && data.cancelledAt ? `${dateTime(data.cancelledAt)} · ${data.cancelledBy?.name ?? "—"}` : data.postedAt ? `${dateTime(data.postedAt)} · ${data.approvedBy?.name ?? "—"}` : "—"}
          </p>
          {data.cancelReason && <p className="text-xs text-muted-foreground">{data.cancelReason}</p>}
        </div>
      </div>

      {counting && (
        <form className="card mb-6 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_140px_1fr_auto] xl:items-end" onSubmit={recordCount}>
          <SearchSelect label="Item" value={itemId} options={itemOptions} onChange={(value) => { setItemId(value); setUnitId(""); }} />
          <SearchSelect label="Satuan" value={unitId} options={unitOptions} disabled={!itemId} placeholder={itemId && !unitOptions.length ? "Memuat satuan..." : "Pilih satuan..."} onChange={setUnitId} />
          <FormInput label="Jumlah fisik" required inputMode="decimal" placeholder="0" value={countQuantity} onChange={(event) => setCountQuantity(event.target.value)} />
          <FormInput label="Catatan" maxLength={500} placeholder="Opsional" value={countNotes} onChange={(event) => setCountNotes(event.target.value)} />
          <button className="btn-primary" disabled={!itemId || !unitId || !countQuantity || !!busy}><Save size={17} /> {busy === "count" ? "Menyimpan..." : "Simpan hitungan"}</button>
          <p className="text-xs text-muted-foreground md:col-span-2 xl:col-span-5">Menghitung ulang item yang sama akan mengganti hitungan sebelumnya. Stok sistem dicatat pada saat hitungan disimpan.</p>
        </form>
      )}

      {!lines.length ? (
        <Empty>{counting ? "Belum ada item yang dihitung." : "Opname ini tidak punya hitungan."}</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
              <tr><th className="p-4">ITEM</th><th className="p-4 text-right">STOK SISTEM*</th><th className="p-4 text-right">FISIK</th><th className="p-4 text-right">SELISIH</th><th className="p-4 text-right">NILAI SELISIH</th><th className="p-4">DIHITUNG</th>{counting && <th className="p-4" />}</tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const variance = Number(line.varianceQuantity);
                const symbol = line.item.baseUnit.symbol;
                return (
                  <tr className="border-b border-border align-top" key={line.id}>
                    <td className="p-4"><p className="font-bold">{line.item.name}</p><p className="text-xs text-muted-foreground">{line.item.sku}{line.notes ? ` · ${line.notes}` : ""}</p></td>
                    <td className="p-4 text-right">{quantity(line.expectedQuantity, 6)} {symbol}</td>
                    <td className="p-4 text-right">{quantity(line.countedQuantity, 6)} {symbol}{line.unit.id !== line.item.baseUnit.id && <p className="text-xs text-muted-foreground">{quantity(line.inputQuantity, 6)} {line.unit.symbol}</p>}</td>
                    <td className={cn("p-4 text-right font-bold", variance > 0 && "text-emerald-700", variance < 0 && "text-red-600")}>{variance > 0 ? "+" : ""}{quantity(line.varianceQuantity, 6)} {symbol}</td>
                    <td className="p-4 text-right">{line.varianceAmount == null ? (data.status === "POSTED" ? "—" : <span className="text-xs text-muted-foreground">saat posting</span>) : signedRupiah(line.varianceAmount, rupiah)}</td>
                    <td className="whitespace-nowrap p-4">{dateTime(line.countedAt)}<p className="text-xs text-muted-foreground">{line.countedBy?.name ?? "—"}</p></td>
                    {counting && (
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          aria-label={`Hapus hitungan ${line.item.name}`}
                          className="btn-ghost !min-h-9 !px-2 text-red-600"
                          disabled={!!busy}
                          onClick={() => run("remove", `/inventory/stocktakes/${id}/counts/${line.item.id}`, { method: "DELETE" }, "Hitungan dihapus.")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted-foreground">
            <p>* Stok sistem saat item dihitung. Penjualan setelah itu tetap tercatat; yang diposting hanya selisihnya.</p>
            <p>{lines.length} item dihitung · {varianceLines.length} ada selisih{postedTotal !== null && <> · total <span className="font-black text-foreground">{signedRupiah(postedTotal, rupiah)}</span></>}</p>
          </div>
        </div>
      )}

      {open && (
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button type="button" className="btn-ghost text-red-600" disabled={!!busy} onClick={cancel}><XCircle size={17} /> {busy === "cancel" ? "Membatalkan..." : "Batalkan opname"}</button>
          {counting && <button type="button" className="btn-primary" disabled={!lines.length || !!busy} onClick={() => run("submit", `/inventory/stocktakes/${id}/submit`, { method: "POST" }, "Opname dikirim untuk persetujuan.")}><Send size={17} /> {busy === "submit" ? "Mengirim..." : "Kirim untuk persetujuan"}</button>}
          {review && isOwner && <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => run("reopen", `/inventory/stocktakes/${id}/reopen`, { method: "POST" }, "Opname dikembalikan untuk dihitung ulang.")}><RotateCcw size={17} /> {busy === "reopen" ? "Mengembalikan..." : "Kembalikan untuk hitung ulang"}</button>}
          {review && isOwner && <button type="button" className="btn-primary" disabled={!!busy} onClick={approve}><CheckCircle2 size={17} /> {busy === "approve" ? "Memposting..." : "Setujui & posting"}</button>}
          {review && !isOwner && <p className="flex items-center gap-2 text-sm text-muted-foreground"><ClipboardCheck size={16} /> Menunggu persetujuan owner.</p>}
        </div>
      )}
    </>
  );
}
