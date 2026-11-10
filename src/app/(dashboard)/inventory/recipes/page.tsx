"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CookingPot, Plus, Settings2, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { FormInput, FormTextarea, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import type { InventoryItem, Product, StockLocation } from "@/lib/types";
import { Feedback, PageResult, quantity } from "../inventory-ui";

type RecipeLine = { id: string; itemId: string; quantity: string };
type RecipeVersion = { id: string; version: number; notes?: string | null; lines: Array<{ id: string; itemId: string; quantity: string; item: InventoryItem }> };
type InventoryConfig = { id: string; mode: "DIRECT" | "RECIPE"; locationId: string; directItemId?: string | null; directQuantity?: string | null; location: StockLocation; directItem?: InventoryItem | null; activeRecipeVersion?: RecipeVersion | null };
type RecipeProduct = Product & { category: { id: string; name: string }; inventoryConfig?: InventoryConfig | null };
type RecipeResponse = { data: RecipeProduct[]; meta: { total: number } };

export default function InventoryRecipesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RecipeProduct | null>(null);
  const [mode, setMode] = useState<"DIRECT" | "RECIPE">("RECIPE");
  const [locationId, setLocationId] = useState("");
  const [directItemId, setDirectItemId] = useState("");
  const [directQuantity, setDirectQuantity] = useState("1");
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const recipes = useQuery({ queryKey: ["inventory-recipes"], queryFn: () => api<RecipeResponse>("/inventory/recipes") });
  const items = useQuery({ queryKey: ["inventory-items", "recipe"], queryFn: () => api<PageResult<InventoryItem>>("/inventory/items?page=1&limit=100&status=ACTIVE") });
  const locations = useQuery({ queryKey: ["inventory-locations", "recipe"], queryFn: () => api<PageResult<StockLocation>>("/inventory/locations?page=1&limit=100&status=ACTIVE") });
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (recipes.data?.data ?? []).filter((product) => !keyword || `${product.name} ${product.sku} ${product.category.name}`.toLowerCase().includes(keyword));
  }, [recipes.data, search]);

  function open(product: RecipeProduct) {
    const config = product.inventoryConfig;
    setSelected(product);
    setMode(config?.mode ?? "RECIPE");
    setLocationId(config?.locationId ?? "");
    setDirectItemId(config?.directItemId ?? "");
    setDirectQuantity(config?.directQuantity ?? "1");
    setLines(config?.activeRecipeVersion?.lines.map((line) => ({ id: line.id, itemId: line.itemId, quantity: line.quantity })) ?? [{ id: crypto.randomUUID(), itemId: "", quantity: "" }]);
    setNotes(config?.activeRecipeVersion?.notes ?? "");
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      await api(`/inventory/recipes/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify(mode === "DIRECT" ? { mode, locationId, directItemId, directQuantity } : { mode, locationId, notes, lines: lines.map(({ itemId, quantity: lineQuantity }) => ({ itemId, quantity: lineQuantity })) }),
      });
      setMessage(mode === "DIRECT" ? "Mapping stok langsung berhasil disimpan." : "Versi resep baru berhasil dipublikasikan.");
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ["inventory-recipes"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan konfigurasi inventory.");
    } finally {
      setSubmitting(false);
    }
  }

  if (recipes.isLoading || items.isLoading || locations.isLoading) return <Loading label="Memuat resep inventory..." />;
  if (recipes.error) return <ErrorNotice error={recipes.error} />;
  const itemOptions = (items.data?.data ?? []).map((item) => ({ value: item.id, label: item.name, description: `${item.sku} · ${item.baseUnit.symbol}` }));
  const locationOptions = (locations.data?.data ?? []).filter((location) => location.outlet).map((location) => ({ value: location.id, label: location.name, description: location.code }));

  return <>
    <PageHeader title="Resep & mapping produk" description="Tentukan produk kemasan yang memotong stok langsung atau menu yang mengonsumsi resep bahan." />
    <Feedback message={message} error={error} />
    <input className="field mb-4 max-w-xl" placeholder="Cari produk, SKU, atau kategori..." value={search} onChange={(event) => setSearch(event.target.value)} />
    {!filtered.length && <Empty>Belum ada produk yang dapat dikonfigurasi.</Empty>}
    {!!filtered.length && <div className="card overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-4">PRODUK</th><th className="p-4">KATEGORI</th><th className="p-4">MODE</th><th className="p-4">PEMAKAIAN</th><th className="p-4 text-right">AKSI</th></tr></thead><tbody>{filtered.map((product) => { const config = product.inventoryConfig; return <tr className="border-b border-border" key={product.id}><td className="p-4"><p className="font-bold">{product.name}</p><p className="text-xs text-muted-foreground">{product.sku}</p></td><td className="p-4">{product.category.name}</td><td className="p-4">{config ? <span className="badge bg-emerald-100 text-emerald-700">{config.mode === "DIRECT" ? "Stok langsung" : `Resep v${config.activeRecipeVersion?.version}`}</span> : <span className="badge bg-amber-100 text-amber-800">Belum dipetakan</span>}</td><td className="p-4">{config?.mode === "DIRECT" && config.directItem ? `${quantity(config.directQuantity ?? 0, config.directItem.baseUnit.precision)} ${config.directItem.baseUnit.symbol} ${config.directItem.name}` : config?.activeRecipeVersion ? `${config.activeRecipeVersion.lines.length} bahan · ${config.location.name}` : "—"}</td><td className="p-4 text-right"><button className="btn-ghost !min-h-9 !px-3" onClick={() => open(product)}><Settings2 size={15} /> Atur</button></td></tr>; })}</tbody></table></div>}
    {selected && <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}><aside className="h-full w-full max-w-2xl overflow-y-auto bg-background p-5 shadow-2xl"><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Konfigurasi inventory</p><h2 className="mt-1 text-xl font-black">{selected.name}</h2></div><button className="btn-ghost !min-h-9 !px-3" onClick={() => setSelected(null)}><X size={17} /></button></div><form className="mt-6 space-y-4" onSubmit={submit}><SearchSelect label="Mode konsumsi" value={mode} options={[{ value: "RECIPE", label: "Resep bahan" }, { value: "DIRECT", label: "Stok langsung / kemasan" }]} onChange={(value) => setMode(value as "DIRECT" | "RECIPE")} /><SearchSelect label="Lokasi pemotongan stok" value={locationId} options={locationOptions} onChange={setLocationId} />{mode === "DIRECT" ? <><SearchSelect label="Item inventory" value={directItemId} options={itemOptions} onChange={setDirectItemId} /><FormInput label="Jumlah per produk terjual" required inputMode="decimal" value={directQuantity} onChange={(event) => setDirectQuantity(event.target.value)} /></> : <><div className="flex items-center justify-between"><h3 className="font-bold">Bahan per 1 produk</h3><button type="button" className="btn-ghost !min-h-9 !px-3" onClick={() => setLines((current) => [...current, { id: crypto.randomUUID(), itemId: "", quantity: "" }])}><Plus size={15} /> Bahan</button></div>{lines.map((line, index) => <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_150px_auto]" key={line.id}><SearchSelect label={`Bahan ${index + 1}`} value={line.itemId} options={itemOptions} onChange={(value) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, itemId: value } : item))} /><FormInput label="Jumlah dasar" required inputMode="decimal" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: event.target.value } : item))} /><button type="button" className="btn-ghost self-end !min-h-11 !px-3 text-red-600" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Trash2 size={16} /></button></div>)}<FormTextarea label="Catatan versi resep" placeholder="Contoh: revisi porsi November" value={notes} onChange={(event) => setNotes(event.target.value)} /></>}<div className="flex gap-2 border-t border-border pt-4"><button className="btn-primary flex-1" disabled={submitting || !locationId || (mode === "DIRECT" ? !directItemId || !directQuantity : lines.some((line) => !line.itemId || !line.quantity))}><CookingPot size={17} /> {submitting ? "Menyimpan..." : mode === "RECIPE" ? "Publikasikan versi resep" : "Simpan mapping"}</button><button type="button" className="btn-ghost" onClick={() => setSelected(null)}>Batal</button></div></form></aside></div>}
  </>;
}
