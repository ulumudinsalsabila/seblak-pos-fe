"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CookingPot, Plus, Settings2, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FormInput, FormTextarea, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import type { InventoryItem, PrepRecipeItem } from "@/lib/types";
import { Feedback, PageResult, quantity } from "../inventory-ui";

type Line = { id: string; itemId: string; quantity: string };

export default function InventoryPrepRecipesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PrepRecipeItem | null>(null);
  const [outputQuantity, setOutputQuantity] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const recipes = useQuery({ queryKey: ["inventory-prep-recipes"], queryFn: () => api<{ data: PrepRecipeItem[] }>("/inventory/prep-recipes") });
  const items = useQuery({ queryKey: ["inventory-items", "prep-recipe"], queryFn: () => api<PageResult<InventoryItem>>("/inventory/items?page=1&limit=100&status=ACTIVE") });
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (recipes.data?.data ?? []).filter((item) => !keyword || `${item.name} ${item.sku}`.toLowerCase().includes(keyword));
  }, [recipes.data, search]);

  function open(item: PrepRecipeItem) {
    setSelected(item);
    setOutputQuantity(item.recipe?.outputQuantity ?? "");
    setLines(item.recipe?.lines.map((line) => ({ id: line.id, itemId: line.item.id, quantity: line.quantity })) ?? [{ id: crypto.randomUUID(), itemId: "", quantity: "" }]);
    setNotes(item.recipe?.notes ?? "");
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      await api(`/inventory/prep-recipes/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({ outputQuantity, ...(notes.trim() ? { notes: notes.trim() } : {}), lines: lines.map(({ itemId, quantity: lineQuantity }) => ({ itemId, quantity: lineQuantity })) }),
      });
      setMessage(`Resep produksi ${selected.name} tersimpan.`);
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ["inventory-prep-recipes"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan resep produksi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (recipes.isLoading || items.isLoading) return <Loading label="Memuat resep produksi..." />;
  if (recipes.error) return <ErrorNotice error={recipes.error} />;
  if (items.error) return <ErrorNotice error={items.error} />;
  const inputOptions = (items.data?.data ?? []).filter((item) => item.id !== selected?.id).map((item) => ({ value: item.id, label: item.name, description: `${item.sku} · ${item.baseUnit.symbol}` }));
  const unitOf = (id: string) => items.data?.data.find((item) => item.id === id)?.baseUnit.symbol;
  const incomplete = !outputQuantity || lines.some((line) => !line.itemId || !line.quantity);

  return <>
    <PageHeader title="Resep produksi" description="Formula standar untuk bahan setengah jadi seperti sambal atau kuah. Dipakai untuk mengisi otomatis bahan saat produksi." />
    <Feedback message={message} error={error} />
    <input className="field mb-4 max-w-xl" placeholder="Cari bahan setengah jadi..." value={search} onChange={(event) => setSearch(event.target.value)} />
    {!recipes.data?.data.length && <Empty>Belum ada item bertipe barang setengah jadi. Buat dulu di <Link className="font-bold text-primary hover:underline" href="/inventory/items">Item stok</Link>.</Empty>}
    {!!filtered.length && (
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-4">HASIL</th><th className="p-4">STANDAR</th><th className="p-4">BAHAN</th><th className="p-4 text-right">AKSI</th></tr></thead>
          <tbody>
            {filtered.map((item) => (
              <tr className="border-b border-border align-top" key={item.id}>
                <td className="p-4"><p className="font-bold">{item.name}</p><p className="text-xs text-muted-foreground">{item.sku}</p></td>
                <td className="p-4">{item.recipe ? `${quantity(item.recipe.outputQuantity, item.baseUnit.precision)} ${item.baseUnit.symbol}` : <span className="badge bg-amber-100 text-amber-800">Belum ada resep</span>}</td>
                <td className="p-4">{item.recipe ? item.recipe.lines.map((line) => <p key={line.id}>{quantity(line.quantity, line.item.baseUnit.precision)} {line.item.baseUnit.symbol} {line.item.name}</p>) : "—"}</td>
                <td className="p-4 text-right"><button className="btn-ghost !min-h-9 !px-3" onClick={() => open(item)}><Settings2 size={15} /> Atur</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    {selected && (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
        <aside className="h-full w-full max-w-2xl overflow-y-auto bg-background p-5 shadow-2xl">
          <div className="flex justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resep produksi</p><h2 className="mt-1 text-xl font-black">{selected.name}</h2></div>
            <button className="btn-ghost !min-h-9 !px-3" aria-label="Tutup" onClick={() => setSelected(null)}><X size={17} /></button>
          </div>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <Feedback error={error} />
            <FormInput label={`Hasil standar (${selected.baseUnit.symbol})`} required inputMode="decimal" placeholder="Contoh: 900" value={outputQuantity} onChange={(event) => setOutputQuantity(event.target.value)} />
            <div className="flex items-center justify-between"><h3 className="font-bold">Bahan untuk hasil standar</h3><button type="button" className="btn-ghost !min-h-9 !px-3" onClick={() => setLines((current) => [...current, { id: crypto.randomUUID(), itemId: "", quantity: "" }])}><Plus size={15} /> Bahan</button></div>
            {lines.map((line, index) => (
              <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_170px_auto]" key={line.id}>
                <SearchSelect label={`Bahan ${index + 1}`} value={line.itemId} options={inputOptions} onChange={(value) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, itemId: value } : item))} />
                <FormInput label={`Jumlah${unitOf(line.itemId) ? ` (${unitOf(line.itemId)})` : " dasar"}`} required inputMode="decimal" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: event.target.value } : item))} />
                <button type="button" aria-label="Hapus bahan" className="btn-ghost self-end !min-h-11 !px-3 text-red-600" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Trash2 size={16} /></button>
              </div>
            ))}
            <FormTextarea label="Catatan" rows={2} maxLength={500} placeholder="Contoh: masak api kecil 30 menit" value={notes} onChange={(event) => setNotes(event.target.value)} />
            <div className="flex gap-2 border-t border-border pt-4">
              <button className="btn-primary flex-1" disabled={submitting || incomplete}><CookingPot size={17} /> {submitting ? "Menyimpan..." : "Simpan resep"}</button>
              <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>Batal</button>
            </div>
          </form>
        </aside>
      </div>
    )}
  </>;
}
