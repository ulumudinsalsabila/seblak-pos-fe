"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Ban,
  Boxes,
  Clock3,
  PackageSearch,
  Percent,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Wallet,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { dateTime, localDate, rupiah } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { ErrorNotice, Loading, PageHeader, StatusBadge } from "@/components/page-ui";
import { SearchSelect } from "@/components/form-controls";

type ComparisonValue = { current: number | null; previous: number | null; percent: number | null };

type Summary = {
  grossSales: number;
  discount: number;
  netSales: number;
  tax: number;
  collected: number;
  expenses: number;
  netCashflow: number;
  transactionCount: number;
  averageOrderValue: number;
  voidCount: number;
  voidValue: number;
  cogs: number | null;
  grossProfit: number | null;
  costCoverage: { complete: boolean; totalItems: number; missingItems: number };
  comparison: Record<string, ComparisonValue> | null;
};

type TrendPoint = { bucket: string; netSales: number; collected: number; transactionCount: number };

type DashboardData = {
  context: {
    scope: "outlet" | "authorized-outlets";
    outletIds: string[];
    outlets: Array<{ id: string; name: string; code: string }>;
    timezone: string;
    currency: string;
  };
  period: { dateFrom: string; dateTo: string; start: string; endExclusive: string; bucket: "hour" | "day" };
  summary: Summary;
  trend: TrendPoint[];
  paymentMix: Array<{ paymentMethod: Transaction["paymentMethod"]; _count: { _all: number }; _sum: { total: number | null } }>;
  topProducts: Array<{ productName: string; sku: string; _sum: { quantity: number | null; subtotal: number | null } }>;
  categorySales: Array<{ categoryName: string; _sum: { quantity: number | null; subtotal: number | null } }>;
  outletPerformance: Array<{ id: string; name: string; code: string; transactionCount: number; netSales: number; collected: number }>;
  lowStock: Array<{ id: string; name: string; sku: string; stock: number; lowStockThreshold: number; outlet: { name: string; code: string } }>;
  recentTransactions: Array<Pick<Transaction, "id" | "invoiceNo" | "paidAt" | "total" | "paymentMethod" | "status" | "customerName"> & { cashier: { id: string; name: string }; outlet: { id: string; name: string; code: string } }>;
  generatedAt: string;
};

type Preset = "today" | "yesterday" | "7d" | "30d" | "custom";

/** Whether a rise in the metric is good, bad, or neither for the business. */
type Polarity = "up-good" | "up-bad" | "neutral";

const paymentLabels: Record<Transaction["paymentMethod"], string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  TRANSFER: "Transfer",
};

/** Jakarta calendar date `days` away from today, as YYYY-MM-DD. */
function dateOffset(days: number) {
  const today = new Date(`${localDate()}T00:00:00Z`);
  today.setUTCDate(today.getUTCDate() + days);
  return today.toISOString().slice(0, 10);
}

function presetDates(preset: Preset) {
  if (preset === "yesterday") return { from: dateOffset(-1), to: dateOffset(-1) };
  if (preset === "7d") return { from: dateOffset(-6), to: localDate() };
  if (preset === "30d") return { from: dateOffset(-29), to: localDate() };
  return { from: localDate(), to: localDate() };
}

/** Label for a Jakarta wall-clock bucket (`YYYY-MM-DD` or `YYYY-MM-DDTHH:00`), read as-is without browser timezone shifts. */
function bucketLabel(bucket: string, withDate: boolean) {
  const day = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${bucket.slice(0, 10)}T00:00:00Z`));
  if (bucket.length === 10) return day;
  const hour = bucket.slice(11, 16);
  return withDate ? `${day} ${hour}` : hour;
}

export default function DashboardPage() {
  const [scope, setScope] = useState<"outlet" | "authorized-outlets">("outlet");
  const [outletId, setOutletId] = useState("");
  const [preset, setPreset] = useState<Preset>("today");
  const [range, setRange] = useState(() => presetDates("today"));
  const query = useQuery({
    queryKey: ["owner-dashboard", scope, outletId, range.from, range.to],
    queryFn: () => {
      const params = new URLSearchParams({ scope, dateFrom: range.from, dateTo: range.to });
      if (scope === "outlet" && outletId) params.set("outletId", outletId);
      return api<{ data: DashboardData }>(`/dashboard/owner?${params}`);
    },
    // Keep the previous result on screen while filters change.
    placeholderData: keepPreviousData,
    refetchInterval: 5 * 60_000,
  });

  function choosePreset(next: Preset) {
    setPreset(next);
    if (next !== "custom") setRange(presetDates(next));
  }

  const data = query.data?.data;
  const outlets = data?.context.outlets ?? [];
  const summary = data?.summary;
  const comparison = summary?.comparison ?? null;
  const cards = summary
    ? ([
        { key: "netSales", label: "Omzet", value: summary.netSales, icon: TrendingUp, polarity: "up-good", hint: "Penjualan dikurangi diskon, tanpa pajak. Hanya transaksi lunas." },
        { key: "transactionCount", label: "Transaksi", value: summary.transactionCount, icon: ReceiptText, count: true, polarity: "up-good", hint: "Jumlah transaksi lunas." },
        { key: "averageOrderValue", label: "Rata-rata per transaksi", value: summary.averageOrderValue, icon: ShoppingBag, polarity: "up-good", hint: "Omzet dibagi jumlah transaksi lunas." },
        { key: "grossProfit", label: "Laba kotor", value: summary.grossProfit, icon: WalletCards, polarity: "up-good", hint: "Omzet dikurangi HPP item terjual." },
        { key: "discount", label: "Diskon", value: summary.discount, icon: Percent, polarity: "neutral", hint: "Total diskon pada transaksi lunas." },
        { key: "voidValue", label: "Void", value: summary.voidValue, icon: Ban, polarity: "up-bad", hint: `${summary.voidCount} transaksi dibatalkan pada periode ini (nilai tanpa pajak).` },
        { key: "expenses", label: "Pengeluaran", value: summary.expenses, icon: Wallet, polarity: "up-bad", hint: "Pengeluaran operasional tercatat pada periode ini." },
        { key: "netCashflow", label: "Arus kas bersih", value: summary.netCashflow, icon: ArrowUpRight, polarity: "up-good", hint: "Total dibayar pelanggan (termasuk pajak) dikurangi pengeluaran." },
      ] as const)
    : [];

  return (
    <>
      <PageHeader
        title="Ringkasan bisnis"
        description="Semua angka memakai outlet, periode, dan transaksi lunas yang sama."
        action={<Link href="/pos" className="btn-primary">Buka kasir</Link>}
      />

      <section className="card mb-5 grid gap-3 p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto_auto]">
        <SearchSelect
          value={scope === "authorized-outlets" ? "all" : outletId || data?.context.outletIds[0] || ""}
          placeholder="Outlet"
          options={[
            ...(outlets.length > 1 ? [{ value: "all", label: "Semua outlet", description: `${outlets.length} outlet` }] : []),
            ...outlets.map((outlet) => ({ value: outlet.id, label: outlet.name, description: outlet.code })),
          ]}
          searchPlaceholder="Cari outlet..."
          onChange={(value) => {
            if (value === "all") {
              setScope("authorized-outlets");
              setOutletId("");
            } else {
              setScope("outlet");
              setOutletId(value);
            }
          }}
        />
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-[var(--muted)] p-1">
          {(["today", "yesterday", "7d", "30d", "custom"] as Preset[]).map((item) => (
            <button key={item} type="button" aria-pressed={preset === item} onClick={() => choosePreset(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${preset === item ? "bg-[var(--card)] text-[var(--primary)] shadow-sm" : "text-[var(--muted-foreground)]"}`}>
              {{ today: "Hari ini", yesterday: "Kemarin", "7d": "7 hari", "30d": "30 hari", custom: "Pilih tanggal" }[item]}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex gap-2 lg:col-span-2">
            <input aria-label="Tanggal awal" className="field" type="date" value={range.from} max={range.to} onChange={(event) => event.target.value && setRange((current) => ({ ...current, from: event.target.value }))} />
            <input aria-label="Tanggal akhir" className="field" type="date" value={range.to} min={range.from} onChange={(event) => event.target.value && setRange((current) => ({ ...current, to: event.target.value }))} />
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <Clock3 size={15} /> {data ? `Diperbarui ${dateTime(data.generatedAt)}` : "WIB"}
        </div>
        <button type="button" className="btn-ghost flex items-center justify-center gap-2" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw size={16} className={query.isFetching ? "animate-spin" : ""} /> Segarkan
        </button>
      </section>

      {query.error && (
        <div className="mb-5 space-y-2">
          <ErrorNotice error={query.error} />
          <button type="button" className="btn-ghost" onClick={() => query.refetch()}>Coba lagi</button>
        </div>
      )}
      {query.isLoading && <Loading label="Menyiapkan ringkasan bisnis..." />}

      {data && summary && (
        <div className={query.isFetching && query.isPlaceholderData ? "opacity-60 transition-opacity" : undefined} aria-busy={query.isFetching}>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {cards.map((card) => (
              <KpiCard
                key={card.key}
                label={card.label}
                value={card.value}
                count={"count" in card && card.count}
                icon={card.icon}
                hint={card.hint}
                polarity={card.polarity}
                comparison={comparison && card.key in comparison ? comparison[card.key].percent : undefined}
                unavailable={card.key === "grossProfit" && card.value === null}
              />
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.7fr)]">
            <TrendChart data={data.trend} multiDay={data.period.dateFrom !== data.period.dateTo} />
            <PaymentMix data={data.paymentMix} />
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            <RankedList title="Produk terlaris" icon={<Boxes size={19} />} rows={data.topProducts.map((item) => ({ label: item.productName, detail: `${item._sum.quantity ?? 0} terjual`, value: rupiah(item._sum.subtotal ?? 0) }))} empty="Belum ada penjualan produk." />
            {data.outletPerformance.length > 1 && (
              <RankedList title="Performa outlet" icon={<TrendingUp size={19} />} rows={data.outletPerformance.map((item) => ({ label: item.name, detail: `${item.transactionCount} transaksi`, value: rupiah(item.netSales) }))} empty="Belum ada data outlet." />
            )}
            <LowStock rows={data.lowStock} />
          </div>

          <section className="card mt-5 overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] p-5">
              <div><h2 className="font-black">Transaksi terbaru</h2><p className="text-xs text-[var(--muted-foreground)]">Transaksi lunas terakhir pada periode ini.</p></div>
              <Link href="/transactions" className="flex items-center gap-1 text-sm font-bold text-[var(--primary)]">Lihat semua <ArrowRight size={15} /></Link>
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm"><thead className="bg-[var(--muted)] text-left text-xs text-[var(--muted-foreground)]"><tr><th className="p-4">INVOICE</th><th>OUTLET</th><th>WAKTU</th><th>METODE</th><th>STATUS</th><th className="pr-4 text-right">TOTAL</th></tr></thead><tbody>{data.recentTransactions.map((item) => <tr key={item.id} className="border-t border-[var(--border)]"><td className="p-4"><Link className="font-black hover:text-[var(--primary)]" href={`/transactions/${item.id}`}>{item.invoiceNo}</Link></td><td>{item.outlet.name}</td><td>{dateTime(item.paidAt)}</td><td>{paymentLabels[item.paymentMethod] ?? item.paymentMethod}</td><td><StatusBadge status={item.status} /></td><td className="pr-4 text-right font-black">{rupiah(item.total)}</td></tr>)}</tbody></table>
            </div>
            <div className="divide-y divide-[var(--border)] md:hidden">{data.recentTransactions.map((item) => <Link href={`/transactions/${item.id}`} key={item.id} className="flex items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="truncate font-black">{item.invoiceNo}</p><p className="text-xs text-[var(--muted-foreground)]">{item.outlet.name} · {dateTime(item.paidAt)}</p></div><b>{rupiah(item.total)}</b></Link>)}</div>
            {!data.recentTransactions.length && <p className="p-8 text-center text-[var(--muted-foreground)]">Belum ada transaksi pada periode ini.</p>}
          </section>
        </div>
      )}
    </>
  );
}

function KpiCard({ label, value, count, icon: Icon, hint, polarity, comparison, unavailable }: { label: string; value: number | null; count?: boolean; icon: typeof TrendingUp; hint: string; polarity: Polarity; comparison?: number | null; unavailable?: boolean }) {
  // undefined: comparison switched off; null: no previous value to compare with.
  const direction = comparison === undefined || comparison === null || comparison === 0 ? "flat" : comparison > 0 ? "up" : "down";
  const tone =
    direction === "flat" || polarity === "neutral"
      ? "text-[var(--muted-foreground)]"
      : (direction === "up") === (polarity === "up-good")
        ? "text-emerald-700"
        : "text-red-600";
  return <article className="card min-w-0 p-4">
    <div className="flex items-start justify-between gap-2">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent)] text-[var(--primary)]"><Icon size={20} /></span>
      {comparison !== undefined && !unavailable && (
        <span className={`flex items-center gap-0.5 text-xs font-black ${tone}`} title="Dibanding periode sebelumnya">
          {direction === "up" && <ArrowUpRight size={14} aria-hidden />}
          {direction === "down" && <ArrowDownRight size={14} aria-hidden />}
          {comparison === null ? "—" : `${Math.abs(comparison)}%`}
          <span className="sr-only">{comparison === null ? "tidak ada pembanding" : direction === "up" ? "naik" : direction === "down" ? "turun" : "tetap"} dibanding periode sebelumnya</span>
        </span>
      )}
    </div>
    <p className="mt-4 truncate text-xs font-bold text-[var(--muted-foreground)]">{label}</p>
    <p className="mt-1 truncate text-xl font-black xl:text-2xl">{unavailable ? "Belum tersedia" : count ? String(value ?? 0) : rupiah(value ?? 0)}</p>
    <p className={`mt-1 text-[11px] ${unavailable ? "text-amber-700" : "text-[var(--muted-foreground)]"}`}>{unavailable ? "Lengkapi HPP produk agar laba kotor bisa dihitung." : hint}</p>
  </article>;
}

function TrendChart({ data, multiDay }: { data: TrendPoint[]; multiDay: boolean }) {
  const max = Math.max(...data.map((item) => item.netSales), 1);
  const points = data.map((item, index) => `${data.length <= 1 ? 50 : (index / (data.length - 1)) * 100},${92 - (item.netSales / max) * 78}`).join(" ");
  const hasSales = data.some((item) => item.netSales > 0);
  return <section className="card p-5">
    <div className="mb-4"><h2 className="font-black">Tren omzet</h2><p className="text-xs text-[var(--muted-foreground)]">Omzet per {data[0]?.bucket.length === 10 ? "hari" : "jam"} pada periode aktif (WIB).</p></div>
    {data.length && hasSales ? <>
      <svg viewBox="0 0 100 100" aria-hidden className="h-56 w-full" preserveAspectRatio="none"><polyline points={`0,100 ${points} 100,100`} fill="var(--primary)" fillOpacity=".12" stroke="none"/><polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="2.2" vectorEffect="non-scaling-stroke"/></svg>
      <div className="flex justify-between text-[10px] text-[var(--muted-foreground)]"><span>{bucketLabel(data[0].bucket, multiDay)}</span><span>{bucketLabel(data.at(-1)!.bucket, multiDay)}</span></div>
      <table className="sr-only"><caption>Omzet per periode</caption><thead><tr><th>Waktu</th><th>Omzet</th><th>Transaksi</th></tr></thead><tbody>{data.map((item) => <tr key={item.bucket}><td>{bucketLabel(item.bucket, true)}</td><td>{rupiah(item.netSales)}</td><td>{item.transactionCount}</td></tr>)}</tbody></table>
    </> : <div className="grid h-56 place-items-center text-sm text-[var(--muted-foreground)]">Belum ada penjualan pada periode ini.</div>}
  </section>;
}

function PaymentMix({ data }: { data: DashboardData["paymentMix"] }) {
  const total = data.reduce((sum, item) => sum + (item._sum.total ?? 0), 0);
  let cursor = 0;
  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"];
  const stops = data.map((item, index) => { const start = cursor; cursor += total ? ((item._sum.total ?? 0) / total) * 100 : 0; return `${colors[index % colors.length]} ${start}% ${cursor}%`; });
  return <section className="card p-5"><h2 className="font-black">Metode pembayaran</h2><p className="text-xs text-[var(--muted-foreground)]">Total dibayar pelanggan, termasuk pajak.</p><div className="mt-5 flex items-center gap-5"><div aria-hidden className="h-32 w-32 shrink-0 rounded-full" style={{ background: data.length ? `conic-gradient(${stops.join(",")})` : "var(--muted)" }}><div className="m-8 h-16 w-16 rounded-full bg-[var(--card)]" /></div><div className="min-w-0 flex-1 space-y-3">{data.map((item, index) => <div key={item.paymentMethod} className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[index % colors.length] }} /><span className="flex-1">{paymentLabels[item.paymentMethod] ?? item.paymentMethod}<span className="ml-1 text-xs text-[var(--muted-foreground)]">{item._count._all}× · {total ? Math.round(((item._sum.total ?? 0) / total) * 100) : 0}%</span></span><b>{rupiah(item._sum.total ?? 0)}</b></div>)}{!data.length && <p className="text-sm text-[var(--muted-foreground)]">Belum ada pembayaran.</p>}</div></div></section>;
}

function RankedList({ title, icon, rows, empty }: { title: string; icon: React.ReactNode; rows: Array<{ label: string; detail: string; value: string }>; empty: string }) {
  return <section className="card p-5"><h2 className="flex items-center gap-2 font-black">{icon}{title}</h2><div className="mt-4 space-y-3">{rows.slice(0, 6).map((row, index) => <div key={`${row.label}-${index}`} className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--muted)] text-xs font-black">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{row.label}</p><p className="text-xs text-[var(--muted-foreground)]">{row.detail}</p></div><b className="text-sm">{row.value}</b></div>)}{!rows.length && <p className="text-sm text-[var(--muted-foreground)]">{empty}</p>}</div></section>;
}

function LowStock({ rows }: { rows: DashboardData["lowStock"] }) {
  return <section className="card p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-black"><PackageSearch size={19}/>Stok menipis</h2><Link href="/products" className="text-xs font-bold text-[var(--primary)]">Kelola produk</Link></div><div className="mt-4 space-y-3">{rows.slice(0, 6).map((row) => <div key={row.id} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700"><Boxes size={17}/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{row.name}</p><p className="text-xs text-[var(--muted-foreground)]">{row.outlet.name} · batas {row.lowStockThreshold}</p></div><b className="text-amber-700">Sisa {row.stock}</b></div>)}{!rows.length && <p className="text-sm text-[var(--muted-foreground)]">Tidak ada produk di bawah batas stok. Atur batas stok menipis di halaman produk.</p>}</div></section>;
}
