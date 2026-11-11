"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { FormInput, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import { localDate, rupiah } from "@/lib/format";
import type { FoodCostReport, StockLocation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PageResult, quantity } from "../inventory-ui";

type SortKey = "lossCost" | "actualCost" | "salesCost";

const money = (value: string | number) => rupiah(Math.round(Number(value)));
const percent = (value: string | null) => (value === null ? "—" : `${quantity(value, 1)}%`);
/** First day of the current month in Asia/Jakarta. */
const monthStart = () => `${localDate().slice(0, 8)}01`;
const daysAgo = (days: number) => localDate(new Date(Date.now() - days * 24 * 60 * 60 * 1000));

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export default function InventoryFoodCostReportPage() {
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(() => localDate());
  const [outletId, setOutletId] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lossCost");
  const locations = useQuery({ queryKey: ["inventory-locations", "report"], queryFn: () => api<PageResult<StockLocation>>("/inventory/locations?page=1&limit=100") });
  const validRange = !!dateFrom && !!dateTo && dateFrom <= dateTo;
  const report = useQuery({
    queryKey: ["inventory-food-cost", dateFrom, dateTo, outletId],
    enabled: validRange,
    placeholderData: keepPreviousData,
    queryFn: () => {
      // Whole days in the outlet timezone (Asia/Jakarta).
      const params = new URLSearchParams({
        dateFrom: new Date(`${dateFrom}T00:00:00+07:00`).toISOString(),
        dateTo: new Date(`${dateTo}T23:59:59.999+07:00`).toISOString(),
      });
      if (outletId) params.set("outletId", outletId);
      return api<{ data: FoodCostReport }>(`/inventory/reports/food-cost?${params}`);
    },
  });
  const outletOptions = useMemo(() => {
    const outlets = new Map<string, string>();
    for (const location of locations.data?.data ?? []) if (location.outlet) outlets.set(location.outlet.id, location.outlet.name);
    return [...outlets.entries()].map(([value, label]) => ({ value, label }));
  }, [locations.data]);
  const rows = useMemo(
    () => [...(report.data?.data.items ?? [])].sort((left, right) => Number(right[sortKey]) - Number(left[sortKey])),
    [report.data, sortKey],
  );

  if (locations.isLoading) return <Loading label="Memuat laporan..." />;
  if (locations.error) return <ErrorNotice error={locations.error} />;
  const data = report.data?.data;
  const presets = [
    { label: "Bulan ini", from: monthStart(), to: localDate() },
    { label: "7 hari", from: daysAgo(6), to: localDate() },
    { label: "30 hari", from: daysAgo(29), to: localDate() },
  ];
  const sortHeader = (key: SortKey, label: string) => (
    <th className="p-4 text-right">
      <button type="button" className={cn("font-bold", sortKey === key ? "text-foreground" : "text-muted-foreground hover:text-foreground")} onClick={() => setSortKey(key)} aria-pressed={sortKey === key}>
        {label}{sortKey === key ? " ↓" : ""}
      </button>
    </th>
  );

  return (
    <>
      <PageHeader title="Laporan food cost" description="HPP teoritis dari resep dan opsi yang terjual, dibandingkan dengan HPP aktual setelah waste, selisih opname, penyesuaian, dan barang hilang di perjalanan." />

      <div className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1" role="group" aria-label="Periode cepat">
          {presets.map((preset) => (
            <button key={preset.label} type="button" className={cn("rounded-lg px-3 py-2 text-sm font-semibold", dateFrom === preset.from && dateTo === preset.to ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")} onClick={() => { setDateFrom(preset.from); setDateTo(preset.to); }}>
              {preset.label}
            </button>
          ))}
        </div>
        <FormInput label="Dari" type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} />
        <FormInput label="Sampai" type="date" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} />
        <SearchSelect className="w-60" label="Outlet" value={outletId} clearable placeholder="Semua outlet" options={outletOptions} onChange={setOutletId} />
      </div>

      {!validRange && <Empty>Tanggal awal harus sebelum tanggal akhir.</Empty>}
      {report.isLoading && validRange && <Loading label="Menghitung food cost..." />}
      {report.error && <ErrorNotice error={report.error} />}
      {data && (
        <div className={cn("space-y-6 transition-opacity", report.isFetching && "opacity-60")}>
          {!data.costCoverage.complete && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              <p><span className="font-bold">Data cost belum lengkap.</span> {data.costCoverage.uncostedMovements} pergerakan stok tercatat tanpa harga pokok dan tidak ikut dihitung. Isi saldo awal dengan cost atau catat pembelian untuk item tersebut.</p>
            </div>
          )}

          <section className="card p-5">
            <p className="text-sm text-muted-foreground">Food cost aktual</p>
            <p className="mt-1 text-5xl font-semibold text-foreground">{percent(data.actualFoodCostPercent)}</p>
            <p className="mt-2 text-sm text-muted-foreground">Teoritis {percent(data.theoreticalFoodCostPercent)} · selisih {data.actualFoodCostPercent && data.theoreticalFoodCostPercent ? `${quantity(Number(data.actualFoodCostPercent) - Number(data.theoreticalFoodCostPercent), 1)} poin` : "—"} dari {data.transactionCount} transaksi</p>
          </section>

          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Penjualan bersih" value={money(data.revenue)} note="Subtotal dikurangi diskon, tanpa pajak" />
            <StatTile label="HPP teoritis" value={money(data.theoreticalCost)} note="Bahan sesuai resep dan opsi terjual" />
            <StatTile label="HPP aktual" value={money(data.actualCost)} note="Teoritis ditambah kerugian" />
            <StatTile label="Pembelian" value={money(data.purchaseSpend)} note={`${data.purchaseCount} penerimaan`} />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-black">Kerugian di luar resep</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Waste" value={money(data.wasteCost)} />
              <StatTile label="Selisih stock opname" value={money(data.stocktakeCost)} note="Positif berarti stok fisik kurang" />
              <StatTile label="Penyesuaian manual" value={money(data.adjustmentCost)} note="Positif berarti stok dikurangi" />
              <StatTile label="Hilang di perjalanan" value={money(data.transferLossCost)} />
            </div>
          </section>

          <section className="card flex flex-wrap items-center gap-x-8 gap-y-2 p-4 text-sm">
            <p className="font-bold">Produksi</p>
            <p className="text-muted-foreground">{data.prep.batches} batch selesai</p>
            <p className="text-muted-foreground">Yield {percent(data.prep.yieldPercent)}</p>
            <p className="flex items-center gap-1 text-muted-foreground">Susut {money(data.prep.shrinkageCost)} <Info size={14} aria-label="Sudah termasuk di HPP hasil produksi, tidak ditambahkan lagi" /></p>
          </section>

          <section>
            <h2 className="mb-1 text-lg font-black">Rincian per bahan</h2>
            <p className="mb-3 text-sm text-muted-foreground">Diurutkan dari kerugian terbesar. Klik judul kolom untuk mengganti urutan.</p>
            {!rows.length ? (
              <Empty>Belum ada pemakaian bahan pada periode ini.</Empty>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                    <tr><th className="p-4">BAHAN</th><th className="p-4 text-right">TERJUAL</th>{sortHeader("salesCost", "HPP TEORITIS")}<th className="p-4 text-right">WASTE</th><th className="p-4 text-right">SELISIH OPNAME</th><th className="p-4 text-right">PENYESUAIAN</th>{sortHeader("lossCost", "KERUGIAN")}{sortHeader("actualCost", "HPP AKTUAL")}</tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const unit = row.item?.baseUnit.symbol ?? "";
                      const precision = row.item?.baseUnit.precision ?? 3;
                      const lossShare = Number(row.actualCost) > 0 ? (Number(row.lossCost) / Number(row.actualCost)) * 100 : 0;
                      return (
                        <tr className="border-b border-border" key={row.itemId}>
                          <td className="p-4"><p className="font-bold">{row.item?.name ?? "Item tidak dikenal"}</p><p className="text-xs text-muted-foreground">{row.item?.sku}</p></td>
                          <td className="p-4 text-right">{quantity(row.salesQuantity, precision)} {unit}</td>
                          <td className="p-4 text-right">{money(row.salesCost)}</td>
                          <td className="p-4 text-right">{Number(row.wasteQuantity) ? `${quantity(row.wasteQuantity, precision)} ${unit}` : "—"}</td>
                          <td className="p-4 text-right">{Number(row.stocktakeQuantity) ? `${quantity(row.stocktakeQuantity, precision)} ${unit}` : "—"}</td>
                          <td className="p-4 text-right">{Number(row.adjustmentQuantity) ? `${quantity(row.adjustmentQuantity, precision)} ${unit}` : "—"}</td>
                          <td className="p-4 text-right font-bold">{money(row.lossCost)}{lossShare >= 10 && <span className="ml-1 badge bg-amber-100 text-amber-800">{quantity(lossShare, 0)}%</span>}</td>
                          <td className="p-4 text-right">{money(row.actualCost)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Semua angka dari dokumen yang sudah diposting: penjualan, waste, stock opname, penyesuaian, transfer, dan produksi. Food cost tidak termasuk tenaga kerja, sewa, pajak, atau kemasan yang tidak dicatat sebagai item stok.</p>
          </section>
        </div>
      )}
    </>
  );
}
