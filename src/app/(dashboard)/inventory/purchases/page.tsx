"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { FormInput, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import type { InventoryItem, InventoryUnit, PurchaseReceipt, StockLocation } from "@/lib/types";
import { dateTime, Feedback, PageResult, Pager, quantity, useDebounced } from "../inventory-ui";

type ReceiptLine = { id: string; itemId: string; unitId: string; quantity: string; unitPrice: string };
const blankLine = (id: string): ReceiptLine => ({ id, itemId: "", unitId: "", quantity: "", unitPrice: "" });

/** Units a purchase of this item can be received in: its base unit, units of the same dimension, and its active conversions. */
function receivingUnits(item: InventoryItem | undefined, units: InventoryUnit[]) {
  if (!item) return [];
  const converted = (item.conversions ?? []).filter((conversion) => !conversion.validTo).map((conversion) => conversion.unit);
  const sameDimension = units.filter((unit) => unit.dimension === item.baseUnit.dimension);
  return [item.baseUnit, ...sameDimension, ...converted].filter((unit, index, all) => all.findIndex((other) => other.id === unit.id) === index);
}

export default function InventoryPurchasesPage() {
  const queryClient = useQueryClient();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [locationId, setLocationId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [lines, setLines] = useState<ReceiptLine[]>([blankLine("initial")]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);
  const locations = useQuery({ queryKey: ["inventory-locations", "purchase"], queryFn: () => api<PageResult<StockLocation>>("/inventory/locations?page=1&limit=100&status=ACTIVE") });
  const items = useQuery({ queryKey: ["inventory-items", "purchase"], queryFn: () => api<PageResult<InventoryItem>>("/inventory/items?page=1&limit=100&status=ACTIVE") });
  const units = useQuery({ queryKey: ["inventory-units", "purchase"], queryFn: () => api<PageResult<InventoryUnit>>("/inventory/units?page=1&limit=100&status=ACTIVE") });
  const selectedItemIds = [...new Set(lines.map((line) => line.itemId).filter(Boolean))];
  const itemDetails = useQueries({ queries: selectedItemIds.map((id) => ({ queryKey: ["inventory-item", id], queryFn: () => api<{ data: InventoryItem }>(`/inventory/items/${id}`) })) });
  const receipts = useQuery({
    queryKey: ["inventory-purchases", debouncedSearch, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      return api<PageResult<PurchaseReceipt>>(`/inventory/purchases?${params}`);
    },
  });

  const itemDetail = (id: string) => itemDetails[selectedItemIds.indexOf(id)]?.data?.data;
  const unitsFor = (itemId: string) => receivingUnits(itemDetail(itemId), units.data?.data ?? []);
  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);

  function update(id: string, patch: Partial<ReceiptLine>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (new Set(lines.map((line) => line.itemId)).size !== lines.length) {
      setError("Item yang sama tidak boleh dicatat dua kali dalam satu penerimaan.");
      return;
    }
    setSubmitting(true);
    try {
      await api("/inventory/purchases", {
        method: "POST",
        body: JSON.stringify({
          clientRequestId: requestId,
          locationId,
          supplierName,
          ...(referenceNo ? { referenceNo } : {}),
          lines: lines.map(({ itemId, unitId, quantity: lineQuantity, unitPrice }) => ({ itemId, unitId, quantity: lineQuantity, unitPrice })),
        }),
      });
      setRequestId(crypto.randomUUID());
      setSupplierName("");
      setReferenceNo("");
      setLines([blankLine(crypto.randomUUID())]);
      setPage(1);
      setMessage("Penerimaan pembelian berhasil diposting. Stok dan harga rata-rata sudah diperbarui.");
      await Promise.all(["inventory-purchases", "inventory-overview", "inventory-balances", "inventory-movements"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memposting penerimaan pembelian.");
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
  const ready = locationOptions.length > 0 && itemOptions.length > 0;
  const incomplete = !locationId || !supplierName.trim() || lines.some((line) => !line.itemId || !line.unitId || !line.quantity || !line.unitPrice);

  return (
    <>
      <PageHeader title="Penerimaan pembelian" description="Catat barang masuk dari supplier. Stok bertambah dalam satuan dasar dan harga pokok dihitung rata-rata tertimbang." />
      <Feedback message={message} error={error} />
      {!ready && <div className="card mb-5 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Buat minimal satu item dan satu lokasi aktif sebelum mencatat pembelian.</div>}
      <form className="card mb-8 p-4" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-3">
          <SearchSelect label="Lokasi penerima" value={locationId} options={locationOptions} onChange={setLocationId} />
          <FormInput label="Supplier" required maxLength={150} placeholder="Pasar Induk" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} />
          <FormInput label="No. nota / referensi" maxLength={100} placeholder="Opsional" value={referenceNo} onChange={(event) => setReferenceNo(event.target.value)} />
        </div>
        <div className="mt-4 space-y-3">
          {lines.map((line, index) => {
            const unitOptions = unitsFor(line.itemId).map((unit) => ({ value: unit.id, label: unit.name, description: unit.symbol }));
            return (
              <div className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_130px_170px_auto]" key={line.id}>
                <SearchSelect label={`Item ${index + 1}`} value={line.itemId} options={itemOptions} onChange={(value) => update(line.id, { itemId: value, unitId: "" })} />
                <SearchSelect label="Satuan beli" value={line.unitId} options={unitOptions} disabled={!line.itemId} placeholder={line.itemId && !unitOptions.length ? "Memuat satuan..." : "Pilih satuan..."} onChange={(value) => update(line.id, { unitId: value })} />
                <FormInput label="Jumlah" required inputMode="decimal" placeholder="0" value={line.quantity} onChange={(event) => update(line.id, { quantity: event.target.value })} />
                <FormInput label="Harga per satuan beli" required inputMode="decimal" placeholder="0" value={line.unitPrice} onChange={(event) => update(line.id, { unitPrice: event.target.value })} />
                <button type="button" className="btn-ghost self-end !min-h-11 !px-3 text-red-600" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}><Trash2 size={16} /></button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn-ghost" onClick={() => setLines((current) => [...current, blankLine(crypto.randomUUID())])}><Plus size={17} /> Tambah item</button>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-sm text-muted-foreground">Total <span className="text-base font-black text-foreground">{rupiah(Math.round(total))}</span></p>
            <button className="btn-primary" disabled={!ready || submitting || incomplete}><PackageCheck size={17} /> {submitting ? "Memposting..." : "Posting penerimaan"}</button>
          </div>
        </div>
      </form>

      <h2 className="mb-3 text-lg font-black">Riwayat penerimaan</h2>
      <input className="field mb-4 max-w-xl" placeholder="Cari supplier, nota, atau item..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      {receipts.isLoading && <Loading label="Memuat riwayat penerimaan..." />}
      {receipts.error && <ErrorNotice error={receipts.error} />}
      {!receipts.isLoading && !receipts.data?.data.length && <Empty>Belum ada penerimaan pembelian.</Empty>}
      {!!receipts.data?.data.length && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-4">WAKTU</th><th className="p-4">SUPPLIER</th><th className="p-4">LOKASI</th><th className="p-4">ITEM</th><th className="p-4 text-right">TOTAL</th><th className="p-4">PETUGAS</th></tr></thead>
            <tbody>
              {receipts.data.data.map((receipt) => (
                <tr className="border-b border-border align-top" key={receipt.id}>
                  <td className="whitespace-nowrap p-4">{dateTime(receipt.receivedAt)}</td>
                  <td className="p-4"><p className="font-bold">{receipt.supplierName}</p><p className="text-xs text-muted-foreground">{receipt.referenceNo ?? "—"}</p></td>
                  <td className="p-4">{receipt.location.name}</td>
                  <td className="p-4">{receipt.lines.map((line) => <p key={line.id}>{line.item.name} · {quantity(line.inputQuantity, 6)} {line.unit.symbol}{line.inputUnitPrice === undefined ? "" : ` @ ${rupiah(Math.round(Number(line.inputUnitPrice)))}`}</p>)}</td>
                  <td className="p-4 text-right font-bold">{receipt.totalAmount === undefined ? "—" : rupiah(Math.round(Number(receipt.totalAmount)))}</td>
                  <td className="p-4">{receipt.createdBy?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {receipts.data?.meta && <Pager page={receipts.data.meta.page} totalPages={receipts.data.meta.totalPages} disabled={receipts.isFetching} onChange={setPage} />}
    </>
  );
}
