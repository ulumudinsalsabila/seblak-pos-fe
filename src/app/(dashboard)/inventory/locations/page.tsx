"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPinned, Plus, Power } from "lucide-react";
import { useState } from "react";
import { FormInput, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import type { OutletAccess, StockLocation } from "@/lib/types";
import { Feedback, locationTypeLabel, PageResult, Pager, useDebounced } from "../inventory-ui";

const locationTypes = Object.entries(locationTypeLabel).map(([value, label]) => ({ value, label }));

export default function InventoryLocationsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", code: "", type: "WAREHOUSE", outletId: "" });
  const debouncedSearch = useDebounced(search);
  const locations = useQuery({
    queryKey: ["inventory-locations", debouncedSearch, type, status, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20", status });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (type) params.set("type", type);
      return api<PageResult<StockLocation>>(`/inventory/locations?${params}`);
    },
  });
  const outlets = useQuery({
    queryKey: ["my-outlets"],
    queryFn: () => api<{ data: OutletAccess[] }>("/auth/outlets"),
  });
  const requiresOutlet = form.type === "OUTLET" || form.type === "KITCHEN";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api("/inventory/locations", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          code: form.code,
          type: form.type,
          ...(form.outletId ? { outletId: form.outletId } : {}),
        }),
      });
      setForm({ name: "", code: "", type: "WAREHOUSE", outletId: "" });
      setShowForm(false);
      setMessage("Lokasi stok berhasil ditambahkan.");
      await queryClient.invalidateQueries({ queryKey: ["inventory-locations"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan lokasi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggle(location: StockLocation) {
    setError("");
    try {
      await api(`/inventory/locations/${location.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !location.isActive }),
      });
      setMessage(`Lokasi ${location.isActive ? "dinonaktifkan" : "diaktifkan"}.`);
      await queryClient.invalidateQueries({ queryKey: ["inventory-locations"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengubah lokasi.");
    }
  }

  return (
    <>
      <PageHeader title="Lokasi stok" description="Pisahkan saldo gudang, outlet, dan dapur secara jelas." action={<button className="btn-primary" onClick={() => setShowForm((value) => !value)}><Plus size={17} /> Tambah lokasi</button>} />
      <Feedback message={message} error={error} />
      {showForm && (
        <form className="card mb-6 grid gap-4 p-4 md:grid-cols-2" onSubmit={submit}>
          <FormInput label="Nama lokasi" required placeholder="Gudang pusat" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <FormInput label="Kode lokasi" required placeholder="GUDANG-01" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
          <SearchSelect label="Jenis lokasi" value={form.type} options={locationTypes} onChange={(value) => setForm({ ...form, type: value, outletId: value === "WAREHOUSE" || value === "OTHER" ? "" : form.outletId })} />
          <SearchSelect label="Terhubung ke outlet" value={form.outletId} clearable={!requiresOutlet} placeholder={requiresOutlet ? "Pilih outlet..." : "Tidak wajib"} options={(outlets.data?.data ?? []).map(({ outlet }) => ({ value: outlet.id, label: outlet.name, description: outlet.code }))} onChange={(value) => setForm({ ...form, outletId: value })} />
          <div className="flex gap-2 md:col-span-2"><button className="btn-primary" disabled={submitting || (requiresOutlet && !form.outletId)}>{submitting ? "Menyimpan..." : "Simpan lokasi"}</button><button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Batal</button></div>
        </form>
      )}
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <input className="field" placeholder="Cari nama atau kode lokasi..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <SearchSelect value={type} clearable placeholder="Semua jenis" options={locationTypes} onChange={(value) => { setType(value); setPage(1); }} />
        <SearchSelect value={status} options={[{ value: "ACTIVE", label: "Lokasi aktif" }, { value: "INACTIVE", label: "Lokasi nonaktif" }]} onChange={(value) => { setStatus(value); setPage(1); }} />
      </div>
      {locations.isLoading && <Loading label="Memuat lokasi..." />}
      {locations.error && <ErrorNotice error={locations.error} />}
      {!locations.isLoading && !locations.data?.data.length && <Empty>Belum ada lokasi sesuai filter.</Empty>}
      {!!locations.data?.data.length && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{locations.data.data.map((location) => <article className="card p-4" key={location.id}><div className="flex items-start justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><MapPinned size={19} /></span><button className="btn-ghost !min-h-9 !px-3" title={location.isActive ? "Nonaktifkan" : "Aktifkan"} onClick={() => void toggle(location)}><Power size={15} /> {location.isActive ? "Aktif" : "Nonaktif"}</button></div><h2 className="mt-4 font-bold">{location.name}</h2><p className="mt-1 text-sm text-muted-foreground">{location.code} · {locationTypeLabel[location.type]}</p>{location.outlet && <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs">Outlet: {location.outlet.name}</p>}</article>)}</div>}
      {locations.data?.meta && <Pager page={locations.data.meta.page} totalPages={locations.data.meta.totalPages} disabled={locations.isFetching} onChange={setPage} />}
    </>
  );
}
