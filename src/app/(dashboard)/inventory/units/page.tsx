"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Ruler } from "lucide-react";
import { FormInput, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import type { InventoryUnit } from "@/lib/types";
import { useState } from "react";
import { Feedback, PageResult, Pager, quantity, useDebounced } from "../inventory-ui";

const dimensions = [
  { value: "MASS", label: "Massa / berat" },
  { value: "VOLUME", label: "Volume" },
  { value: "COUNT", label: "Jumlah / unit" },
];

export default function InventoryUnitsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [dimension, setDimension] = useState("");
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    symbol: "",
    dimension: "MASS",
    factorToDimensionBase: "1",
    precision: "3",
  });
  const debouncedSearch = useDebounced(search);
  const units = useQuery({
    queryKey: ["inventory-units", debouncedSearch, dimension, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dimension) params.set("dimension", dimension);
      return api<PageResult<InventoryUnit>>(`/inventory/units?${params}`);
    },
  });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await api("/inventory/units", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          precision: Number(form.precision),
          isBase: false,
        }),
      });
      setForm({ code: "", name: "", symbol: "", dimension: "MASS", factorToDimensionBase: "1", precision: "3" });
      setShowForm(false);
      setMessage("Satuan berhasil ditambahkan.");
      await queryClient.invalidateQueries({ queryKey: ["inventory-units"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menambahkan satuan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Satuan inventory"
        description="Kelola satuan pembelian dan pemakaian. Satuan dasar canonical sudah dibuat otomatis."
        action={
          <button className="btn-primary" onClick={() => setShowForm((value) => !value)}>
            <Plus size={17} /> Tambah satuan
          </button>
        }
      />
      <Feedback message={message} error={error} />
      {showForm && (
        <form className="card mb-6 grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={submit}>
          <FormInput label="Kode" required maxLength={30} placeholder="contoh: sack" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
          <FormInput label="Nama satuan" required placeholder="Karung" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <FormInput label="Simbol" required placeholder="karung" value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value })} />
          <SearchSelect label="Dimensi" value={form.dimension} options={dimensions} onChange={(value) => setForm({ ...form, dimension: value })} />
          <FormInput label="Faktor ke satuan dasar dimensi" required inputMode="decimal" value={form.factorToDimensionBase} onChange={(event) => setForm({ ...form, factorToDimensionBase: event.target.value })} />
          <FormInput label="Presisi tampilan" required type="number" min={0} max={6} value={form.precision} onChange={(event) => setForm({ ...form, precision: event.target.value })} />
          <div className="flex gap-2 md:col-span-2 xl:col-span-3">
            <button className="btn-primary" disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan satuan"}</button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Batal</button>
          </div>
        </form>
      )}
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <input className="field" placeholder="Cari kode, nama, atau simbol..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <SearchSelect value={dimension} clearable placeholder="Semua dimensi" options={dimensions} onChange={(value) => { setDimension(value); setPage(1); }} />
      </div>
      {units.isLoading && <Loading label="Memuat satuan..." />}
      {units.error && <ErrorNotice error={units.error} />}
      {!units.isLoading && !units.data?.data.length && <Empty>Belum ada satuan sesuai filter.</Empty>}
      {!!units.data?.data.length && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-4">SATUAN</th><th className="p-4">DIMENSI</th><th className="p-4 text-right">FAKTOR DASAR</th><th className="p-4 text-center">PRESISI</th><th className="p-4">STATUS</th></tr></thead>
            <tbody>{units.data.data.map((unit) => <tr className="border-b border-border" key={unit.id}><td className="p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Ruler size={17} /></span><div><p className="font-bold">{unit.name} ({unit.symbol})</p><p className="text-xs text-muted-foreground">{unit.code}</p></div></div></td><td className="p-4">{dimensions.find((item) => item.value === unit.dimension)?.label}</td><td className="p-4 text-right font-mono">{quantity(unit.factorToDimensionBase, 9)}</td><td className="p-4 text-center">{unit.precision}</td><td className="p-4"><span className="badge bg-emerald-100 text-emerald-700">{unit.isBase ? "Dasar" : "Aktif"}</span></td></tr>)}</tbody>
          </table>
        </div>
      )}
      {units.data?.meta && <Pager page={units.data.meta.page} totalPages={units.data.meta.totalPages} disabled={units.isFetching} onChange={setPage} />}
    </>
  );
}
