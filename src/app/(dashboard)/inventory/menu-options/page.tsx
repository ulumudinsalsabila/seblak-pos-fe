"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Plus, Settings2, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FormInput, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import type { InventoryItem, MenuOptionConsumptionGroup, StockLocation } from "@/lib/types";
import { Feedback, PageResult, quantity } from "../inventory-ui";

type Line = { id: string; itemId: string; quantity: string };
type Selected = { group: MenuOptionConsumptionGroup; value: MenuOptionConsumptionGroup["values"][number] };

export default function InventoryMenuOptionsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [locationId, setLocationId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const options = useQuery({ queryKey: ["inventory-menu-options"], queryFn: () => api<{ data: MenuOptionConsumptionGroup[] }>("/inventory/menu-options") });
  const items = useQuery({ queryKey: ["inventory-items", "menu-option"], queryFn: () => api<PageResult<InventoryItem>>("/inventory/items?page=1&limit=100&status=ACTIVE") });
  const locations = useQuery({ queryKey: ["inventory-locations", "menu-option"], queryFn: () => api<PageResult<StockLocation>>("/inventory/locations?page=1&limit=100&status=ACTIVE") });
  const groups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (options.data?.data ?? [])
      .map((group) => ({ ...group, values: group.values.filter((value) => !keyword || `${group.name} ${value.label}`.toLowerCase().includes(keyword)) }))
      .filter((group) => group.values.length);
  }, [options.data, search]);

  function open(group: MenuOptionConsumptionGroup, value: Selected["value"]) {
    setSelected({ group, value });
    setLocationId(value.consumption[0]?.location.id ?? "");
    setLines(value.consumption.length ? value.consumption.map((row) => ({ id: row.id, itemId: row.item.id, quantity: row.quantity })) : [{ id: crypto.randomUUID(), itemId: "", quantity: "" }]);
    setError("");
  }

  async function save(nextLines: Line[]) {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      await api(`/inventory/menu-options/${encodeURIComponent(selected.group.id)}/${encodeURIComponent(selected.value.id)}`, {
        method: "PUT",
        body: JSON.stringify({ ...(nextLines.length ? { locationId } : {}), lines: nextLines.map(({ itemId, quantity: lineQuantity }) => ({ itemId, quantity: lineQuantity })) }),
      });
      setMessage(nextLines.length ? `Bahan untuk ${selected.group.name}: ${selected.value.label} tersimpan.` : `${selected.group.name}: ${selected.value.label} tidak lagi memotong bahan.`);
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ["inventory-menu-options"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan bahan opsi.");
    } finally {
      setSubmitting(false);
    }
  }

  if (options.isLoading || items.isLoading || locations.isLoading) return <Loading label="Memuat opsi menu..." />;
  if (options.error) return <ErrorNotice error={options.error} />;
  if (items.error) return <ErrorNotice error={items.error} />;
  if (locations.error) return <ErrorNotice error={locations.error} />;
  const itemOptions = (items.data?.data ?? []).map((item) => ({ value: item.id, label: item.name, description: `${item.sku} · ${item.baseUnit.symbol}` }));
  const itemUnit = (id: string) => items.data?.data.find((item) => item.id === id)?.baseUnit.symbol;
  const locationOptions = (locations.data?.data ?? []).filter((location) => location.outlet).map((location) => ({ value: location.id, label: location.name, description: location.code }));
  const incomplete = !locationId || lines.some((line) => !line.itemId || !line.quantity);

  return <>
    <PageHeader title="Bahan opsi menu" description="Atur bahan yang terpakai untuk setiap topping, level pedas, atau tambahan. Bahan dipotong per porsi yang terjual, di luar resep produknya." />
    <Feedback message={message} error={error} />
    <input className="field mb-4 max-w-xl" placeholder="Cari grup atau nilai opsi..." value={search} onChange={(event) => setSearch(event.target.value)} />
    {!options.data?.data.length && <Empty>Belum ada opsi menu. Buat dulu di <Link className="font-bold text-primary hover:underline" href="/options">Opsi Menu</Link>.</Empty>}
    {!!options.data?.data.length && !groups.length && <Empty>Tidak ada opsi yang cocok.</Empty>}
    <div className="space-y-5">
      {groups.map((group) => (
        <section className="card overflow-x-auto" key={group.id}>
          <div className="flex items-center gap-2 border-b border-border p-4"><h2 className="font-black">{group.name}</h2>{!group.isActive && <span className="badge bg-muted text-muted-foreground">Nonaktif</span>}</div>
          <table className="w-full min-w-[700px] text-left text-sm">
            <tbody>
              {group.values.map((value) => (
                <tr className="border-b border-border last:border-0" key={value.id}>
                  <td className="w-1/4 p-4 font-bold">{value.label}</td>
                  <td className="p-4">{value.consumption.length ? <>{value.consumption.map((row) => <p key={row.id}>{quantity(row.quantity, row.item.baseUnit.precision)} {row.item.baseUnit.symbol} {row.item.name}</p>)}<p className="text-xs text-muted-foreground">{value.consumption[0].location.name}</p></> : <span className="text-muted-foreground">Tidak memotong bahan</span>}</td>
                  <td className="p-4 text-right"><button className="btn-ghost !min-h-9 !px-3" onClick={() => open(group, value)}><Settings2 size={15} /> Atur</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
    {selected && (
      <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
        <aside className="h-full w-full max-w-2xl overflow-y-auto bg-background p-5 shadow-2xl">
          <div className="flex justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{selected.group.name}</p><h2 className="mt-1 text-xl font-black">{selected.value.label}</h2></div>
            <button className="btn-ghost !min-h-9 !px-3" aria-label="Tutup" onClick={() => setSelected(null)}><X size={17} /></button>
          </div>
          <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void save(lines); }}>
            <Feedback error={error} />
            <SearchSelect label="Lokasi pemotongan stok" value={locationId} options={locationOptions} onChange={setLocationId} />
            <div className="flex items-center justify-between"><h3 className="font-bold">Bahan per 1 porsi</h3><button type="button" className="btn-ghost !min-h-9 !px-3" onClick={() => setLines((current) => [...current, { id: crypto.randomUUID(), itemId: "", quantity: "" }])}><Plus size={15} /> Bahan</button></div>
            {lines.map((line, index) => (
              <div className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_170px_auto]" key={line.id}>
                <SearchSelect label={`Bahan ${index + 1}`} value={line.itemId} options={itemOptions} onChange={(value) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, itemId: value } : item))} />
                <FormInput label={`Jumlah${itemUnit(line.itemId) ? ` (${itemUnit(line.itemId)})` : " dasar"}`} required inputMode="decimal" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: event.target.value } : item))} />
                <button type="button" aria-label="Hapus bahan" className="btn-ghost self-end !min-h-11 !px-3 text-red-600" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Trash2 size={16} /></button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <button className="btn-primary flex-1" disabled={submitting || incomplete}><ListChecks size={17} /> {submitting ? "Menyimpan..." : "Simpan bahan"}</button>
              {selected.value.consumption.length > 0 && <button type="button" className="btn-ghost text-red-600" disabled={submitting} onClick={() => { if (window.confirm("Hapus semua bahan untuk opsi ini? Penjualan berikutnya tidak lagi memotong bahan.")) void save([]); }}>Hapus semua bahan</button>}
              <button type="button" className="btn-ghost" onClick={() => setSelected(null)}>Batal</button>
            </div>
          </form>
        </aside>
      </div>
    )}
  </>;
}
