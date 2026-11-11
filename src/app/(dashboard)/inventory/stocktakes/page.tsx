"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormInput, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import type { StockLocation, Stocktake } from "@/lib/types";
import { dateTime, Feedback, PageResult, Pager, stocktakeStatusLabel } from "../inventory-ui";
import { StocktakeStatusBadge } from "./stocktake-ui";

export default function InventoryStocktakesPage() {
  const router = useRouter();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [locationId, setLocationId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const locations = useQuery({ queryKey: ["inventory-locations", "stocktake"], queryFn: () => api<PageResult<StockLocation>>("/inventory/locations?page=1&limit=100&status=ACTIVE") });
  const stocktakes = useQuery({
    queryKey: ["inventory-stocktakes", status, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (status) params.set("status", status);
      return api<PageResult<Stocktake>>(`/inventory/stocktakes?${params}`);
    },
  });

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await api<{ data: Stocktake }>("/inventory/stocktakes", {
        method: "POST",
        body: JSON.stringify({ clientRequestId: requestId, locationId, ...(notes.trim() ? { notes: notes.trim() } : {}) }),
      });
      setRequestId(crypto.randomUUID());
      router.push(`/inventory/stocktakes/${response.data.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memulai stock opname.");
      setSubmitting(false);
    }
  }

  if (locations.isLoading) return <Loading label="Memuat lokasi..." />;
  if (locations.error) return <ErrorNotice error={locations.error} />;
  const locationOptions = (locations.data?.data ?? []).map((location) => ({ value: location.id, label: location.name, description: location.code }));

  return (
    <>
      <PageHeader title="Stock opname" description="Hitung stok fisik per lokasi. Selisih dihitung terhadap stok saat item dihitung, jadi penjualan yang tetap berjalan selama opname tidak tertimpa." />
      <Feedback error={error} />
      <form className="card mb-8 grid gap-4 p-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end" onSubmit={start}>
        <SearchSelect label="Lokasi" value={locationId} options={locationOptions} onChange={setLocationId} />
        <FormInput label="Catatan" maxLength={500} placeholder="Opsional, contoh: opname akhir bulan" value={notes} onChange={(event) => setNotes(event.target.value)} />
        <button className="btn-primary" disabled={!locationId || submitting}><ClipboardCheck size={17} /> {submitting ? "Memulai..." : "Mulai opname"}</button>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black">Daftar opname</h2>
        <SearchSelect className="w-60" value={status} clearable placeholder="Semua status" options={Object.entries(stocktakeStatusLabel).map(([value, label]) => ({ value, label }))} onChange={(value) => { setStatus(value); setPage(1); }} />
      </div>
      {stocktakes.isLoading && <Loading label="Memuat stock opname..." />}
      {stocktakes.error && <ErrorNotice error={stocktakes.error} />}
      {!stocktakes.isLoading && !stocktakes.data?.data.length && <Empty>Belum ada stock opname.</Empty>}
      {!!stocktakes.data?.data.length && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-4">DIBUAT</th><th className="p-4">LOKASI</th><th className="p-4">STATUS</th><th className="p-4 text-right">ITEM DIHITUNG</th><th className="p-4">DIBUAT OLEH</th><th className="p-4">DIPOSTING</th></tr></thead>
            <tbody>
              {stocktakes.data.data.map((stocktake) => (
                <tr className="border-b border-border hover:bg-muted/40" key={stocktake.id}>
                  <td className="whitespace-nowrap p-4"><Link className="font-bold text-primary hover:underline" href={`/inventory/stocktakes/${stocktake.id}`}>{dateTime(stocktake.createdAt)}</Link><p className="text-xs text-muted-foreground">{stocktake.notes ?? ""}</p></td>
                  <td className="p-4">{stocktake.location.name}</td>
                  <td className="p-4"><StocktakeStatusBadge status={stocktake.status} /></td>
                  <td className="p-4 text-right">{stocktake._count?.lines ?? 0}</td>
                  <td className="p-4">{stocktake.createdBy?.name ?? "—"}</td>
                  <td className="whitespace-nowrap p-4">{stocktake.postedAt ? `${dateTime(stocktake.postedAt)} · ${stocktake.approvedBy?.name ?? "—"}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {stocktakes.data?.meta && <Pager page={stocktakes.data.meta.page} totalPages={stocktakes.data.meta.totalPages} disabled={stocktakes.isFetching} onChange={setPage} />}
    </>
  );
}
