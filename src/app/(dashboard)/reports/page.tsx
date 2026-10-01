"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { localDate, rupiah } from "@/lib/format";
import { ErrorNotice, Loading, PageHeader } from "@/components/ui";
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
};
export default function ReportsPage() {
  const [from, setFrom] = useState(localDate());
  const [to, setTo] = useState(localDate());
  const query = useQuery({
    queryKey: ["reports", from, to],
    queryFn: () =>
      api<{ data: Summary }>(`/reports/sales?dateFrom=${from}&dateTo=${to}`),
  });
  const payments = useQuery({
    queryKey: ["payments", from, to],
    queryFn: () =>
      api<{
        data: Array<{
          paymentMethod: string;
          _count: { _all: number };
          _sum: { total: number };
        }>;
      }>(`/reports/payments?dateFrom=${from}&dateTo=${to}`),
  });
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} />;
  const data = query.data!.data;
  const cards = [
    ["Gross sales", data.grossSales],
    ["Diskon", data.discount],
    ["Net sales", data.netSales],
    ["Pajak", data.tax],
    ["Terkumpul", data.collected],
    ["Pengeluaran", data.expenses],
    ["Net cashflow", data.netCashflow],
    ["AOV", data.averageOrderValue],
  ];
  return (
    <>
      <PageHeader
        title="Laporan"
        description="Angka hanya mencakup transaksi PAID."
        action={
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:w-auto">
            <input
              aria-label="Tanggal awal laporan"
              className="field min-w-0 !px-2 text-xs sm:!px-3 sm:text-sm"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              aria-label="Tanggal akhir laporan"
              className="field min-w-0 !px-2 text-xs sm:!px-3 sm:text-sm"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {cards.map(([label, value]) => (
          <div
            className="card min-w-0 overflow-hidden p-3 sm:p-4 xl:p-5"
            key={String(label)}
          >
            <p className="truncate text-xs font-bold text-[#796c63] sm:text-sm">
              {label}
            </p>
            <p className="mt-2 text-base font-black leading-tight sm:text-lg xl:mt-3 xl:text-xl 2xl:text-2xl">
              {rupiah(Number(value))}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-2 md:gap-6">
        <section className="card min-w-0 p-4 sm:p-5">
          <h2 className="mb-2 font-black sm:mb-4">Ringkasan</h2>
          <div className="flex flex-wrap justify-between gap-2 border-b border-[#eadfd3] py-3 text-sm sm:text-base">
            <span>Jumlah transaksi</span>
            <b>{data.transactionCount}</b>
          </div>
          <div className="flex flex-wrap justify-between gap-2 py-3 text-sm sm:text-base">
            <span>Net cashflow</span>
            <b
              className={
                data.netCashflow >= 0 ? "text-emerald-700" : "text-red-600"
              }
            >
              {rupiah(data.netCashflow)}
            </b>
          </div>
        </section>
        <section className="card min-w-0 p-4 sm:p-5">
          <h2 className="mb-2 font-black sm:mb-4">Metode pembayaran</h2>
          {payments.data?.data.map((item) => (
            <div
              key={item.paymentMethod}
              className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-[#eadfd3] py-3 text-sm last:border-0 sm:text-base"
            >
              <span>
                {item.paymentMethod} · {item._count._all} trx
              </span>
              <b className="ml-auto">{rupiah(item._sum.total ?? 0)}</b>
            </div>
          ))}
          {payments.isLoading && (
            <p className="py-3 text-sm text-[#796c63]">Memuat pembayaran...</p>
          )}
          {payments.error && <ErrorNotice error={payments.error} />}
          {!payments.isLoading && !payments.data?.data.length && (
            <p className="py-3 text-sm text-[#796c63]">
              Belum ada pembayaran pada periode ini.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
