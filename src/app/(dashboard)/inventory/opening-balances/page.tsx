"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { FormInput, SearchSelect } from "@/components/form-controls";
import { ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import type { InventoryItem, StockLocation } from "@/lib/types";
import { Feedback, PageResult } from "../inventory-ui";

type OpeningLine = { id: string; locationId: string; itemId: string; quantity: string; unitCost: string; notes: string };
const blankLine = (id: string): OpeningLine => ({ id, locationId: "", itemId: "", quantity: "", unitCost: "", notes: "" });
const newLine = () => blankLine(crypto.randomUUID());

export default function OpeningBalancesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<OpeningLine[]>([blankLine("initial")]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const locations = useQuery({ queryKey: ["inventory-locations", "opening"], queryFn: () => api<PageResult<StockLocation>>("/inventory/locations?page=1&limit=100&status=ACTIVE") });
  const items = useQuery({ queryKey: ["inventory-items", "opening"], queryFn: () => api<PageResult<InventoryItem>>("/inventory/items?page=1&limit=100&status=ACTIVE") });

  function update(id: string, patch: Partial<OpeningLine>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const pairs = lines.map((line) => `${line.locationId}:${line.itemId}`);
    if (new Set(pairs).size !== pairs.length) {
      setError("Item dan lokasi yang sama tidak boleh dicatat dua kali dalam satu batch.");
      return;
    }
    setSubmitting(true);
    try {
      await api("/inventory/opening-balances", {
        method: "POST",
        body: JSON.stringify({
          batchId: crypto.randomUUID(),
          lines: lines.map(({ locationId, itemId, quantity, unitCost, notes }) => ({
            locationId,
            itemId,
            quantity,
            ...(unitCost ? { unitCost } : {}),
            ...(notes ? { notes } : {}),
          })),
        }),
      });
      setLines([blankLine("initial")]);
      setMessage("Saldo awal berhasil diposting dan tercatat pada ledger.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-balances"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-movements"] }),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memposting saldo awal.");
    } finally {
      setSubmitting(false);
    }
  }

  if (user?.role !== "OWNER") {
    return <><PageHeader title="Saldo awal" description="Posting posisi stok saat mulai menggunakan inventory." /><ErrorNotice error={new Error("Hanya pemilik yang dapat memposting saldo awal.")} /></>;
  }
  if (locations.isLoading || items.isLoading) return <Loading label="Menyiapkan master inventory..." />;
  if (locations.error) return <ErrorNotice error={locations.error} />;
  if (items.error) return <ErrorNotice error={items.error} />;

  const locationOptions = (locations.data?.data ?? []).map((location) => ({ value: location.id, label: location.name, description: location.code }));
  const itemOptions = (items.data?.data ?? []).map((item) => ({ value: item.id, label: item.name, description: `${item.sku} · ${item.baseUnit.symbol}` }));
  const ready = locationOptions.length > 0 && itemOptions.length > 0;

  return (
    <>
      <PageHeader title="Saldo awal" description="Gunakan sekali sebelum item memiliki movement. Setelah diposting, koreksi harus melalui adjustment." />
      <Feedback message={message} error={error} />
      {!ready && <div className="card mb-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Buat minimal satu item dan satu lokasi aktif sebelum mengisi saldo awal.</div>}
      <form onSubmit={submit}>
        <div className="space-y-3">
          {lines.map((line, index) => (
            <section className="card p-4" key={line.id}>
              <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Baris {index + 1}</h2>{lines.length > 1 && <button type="button" className="btn-ghost !min-h-9 !px-3 text-red-600" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Trash2 size={15} /> Hapus</button>}</div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><SearchSelect label="Lokasi" value={line.locationId} options={locationOptions} onChange={(value) => update(line.id, { locationId: value })} /><SearchSelect label="Item" value={line.itemId} options={itemOptions} onChange={(value) => update(line.id, { itemId: value })} /><FormInput label="Jumlah" required inputMode="decimal" placeholder="0" value={line.quantity} onChange={(event) => update(line.id, { quantity: event.target.value })} /><FormInput label="Biaya per unit" inputMode="decimal" placeholder="Opsional" value={line.unitCost} onChange={(event) => update(line.id, { unitCost: event.target.value })} /><FormInput label="Catatan" placeholder="Hasil stock opname" value={line.notes} onChange={(event) => update(line.id, { notes: event.target.value })} /></div>
            </section>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap justify-between gap-3"><button type="button" className="btn-ghost" onClick={() => setLines((current) => [...current, newLine()])}><Plus size={17} /> Tambah baris</button><button className="btn-primary" disabled={!ready || submitting || lines.some((line) => !line.locationId || !line.itemId || !line.quantity)}><Send size={17} /> {submitting ? "Memposting..." : `Posting ${lines.length} saldo awal`}</button></div>
      </form>
    </>
  );
}
