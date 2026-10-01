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
          <div className="flex gap-2">
            <input
              className="field"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              className="field"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div className="card p-5" key={String(label)}>
            <p className="text-sm font-bold text-[#796c63]">{label}</p>
            <p className="mt-3 text-2xl font-black">{rupiah(Number(value))}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-black">Ringkasan</h2>
          <div className="flex justify-between border-b border-[#eadfd3] py-3">
            <span>Jumlah transaksi</span>
            <b>{data.transactionCount}</b>
          </div>
          <div className="flex justify-between py-3">
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
        <section className="card p-5">
          <h2 className="mb-4 font-black">Metode pembayaran</h2>
          {payments.data?.data.map((item) => (
            <div
              key={item.paymentMethod}
              className="flex justify-between border-b border-[#eadfd3] py-3 last:border-0"
            >
              <span>
                {item.paymentMethod} · {item._count._all} trx
              </span>
              <b>{rupiah(item._sum.total ?? 0)}</b>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
