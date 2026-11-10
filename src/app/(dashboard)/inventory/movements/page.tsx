"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import type { InventoryItem, StockLocation, StockMovement } from "@/lib/types";
import { dateTime, movementTypeLabel, PageResult, Pager, quantity, useDebounced } from "../inventory-ui";

const movementTypes = Object.entries(movementTypeLabel).map(([value, label]) => ({ value, label }));

export default function InventoryMovementsPage() {
  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [itemId, setItemId] = useState("");
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);
  const locations = useQuery({ queryKey: ["inventory-locations", "movement-filter"], queryFn: () => api<PageResult<StockLocation>>("/inventory/locations?page=1&limit=100&status=ACTIVE") });
  const items = useQuery({ queryKey: ["inventory-items", "movement-filter"], queryFn: () => api<PageResult<InventoryItem>>("/inventory/items?page=1&limit=100&status=ACTIVE") });
  const movements = useQuery({
    queryKey: ["inventory-movements", debouncedSearch, locationId, itemId, type, dateFrom, dateTo, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20", sortBy: "occurredAt", sortOrder: "desc" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (locationId) params.set("locationId", locationId);
      if (itemId) params.set("itemId", itemId);
      if (type) params.set("type", type);
      if (dateFrom) params.set("dateFrom", new Date(`${dateFrom}T00:00:00`).toISOString());
      if (dateTo) params.set("dateTo", new Date(`${dateTo}T23:59:59.999`).toISOString());
      return api<PageResult<StockMovement>>(`/inventory/movements?${params}`);
    },
  });
  const resetPage = () => setPage(1);

  return (
    <>
      <PageHeader title="Kartu stok" description="Ledger immutable untuk menelusuri setiap perubahan saldo inventory." />
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input className="field" placeholder="Cari item, SKU, atau referensi..." value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} />
        <SearchSelect value={locationId} clearable placeholder="Semua lokasi" options={(locations.data?.data ?? []).map((location) => ({ value: location.id, label: location.name, description: location.code }))} onChange={(value) => { setLocationId(value); resetPage(); }} />
        <SearchSelect value={itemId} clearable placeholder="Semua item" options={(items.data?.data ?? []).map((item) => ({ value: item.id, label: item.name, description: item.sku }))} onChange={(value) => { setItemId(value); resetPage(); }} />
        <SearchSelect value={type} clearable placeholder="Semua jenis movement" options={movementTypes} onChange={(value) => { setType(value); resetPage(); }} />
        <label><span className="label">Dari tanggal</span><input className="field" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); resetPage(); }} /></label>
        <label><span className="label">Sampai tanggal</span><input className="field" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); resetPage(); }} /></label>
      </div>
      {movements.isLoading && <Loading label="Memuat kartu stok..." />}
      {movements.error && <ErrorNotice error={movements.error} />}
      {!movements.isLoading && !movements.data?.data.length && <Empty>Belum ada movement inventory sesuai filter.</Empty>}
      {!!movements.data?.data.length && <div className="card overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-4">WAKTU</th><th className="p-4">ITEM</th><th className="p-4">LOKASI</th><th className="p-4">JENIS</th><th className="p-4 text-right">PERUBAHAN</th><th className="p-4 text-right">SALDO</th><th className="p-4 text-right">COST</th><th className="p-4">REFERENSI</th></tr></thead><tbody>{movements.data.data.map((movement) => { const incoming = movement.direction === "IN"; return <tr className="border-b border-border" key={movement.id}><td className="whitespace-nowrap p-4">{dateTime(movement.occurredAt)}</td><td className="p-4"><p className="font-bold">{movement.item.name}</p><p className="text-xs text-muted-foreground">{movement.item.sku}</p></td><td className="p-4">{movement.location.name}</td><td className="p-4">{movementTypeLabel[movement.type] ?? movement.type}</td><td className={`p-4 text-right font-bold ${incoming ? "text-emerald-700" : "text-red-700"}`}><span className="inline-flex items-center gap-1">{incoming ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}{incoming ? "+" : "-"}{quantity(movement.quantity, movement.item.baseUnit.precision)} {movement.item.baseUnit.symbol}</span></td><td className="p-4 text-right font-bold">{quantity(movement.balanceAfter, movement.item.baseUnit.precision)}</td><td className="p-4 text-right">{movement.unitCost === undefined ? "—" : rupiah(Math.round(Number(movement.unitCost)))}</td><td className="p-4"><p>{movement.sourceType}</p><p className="max-w-44 truncate text-xs text-muted-foreground" title={movement.sourceId ?? ""}>{movement.sourceId ?? "—"}</p></td></tr>; })}</tbody></table></div>}
      {movements.data?.meta && <Pager page={movements.data.meta.page} totalPages={movements.data.meta.totalPages} disabled={movements.isFetching} onChange={setPage} />}
    </>
  );
}
