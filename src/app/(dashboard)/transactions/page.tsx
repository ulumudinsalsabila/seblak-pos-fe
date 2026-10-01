"use client";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { dateTime, rupiah } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import {
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
export default function TransactionsPage() {
  const [filters, setFilters] = useState({
    invoiceNo: "",
    status: "",
    paymentMethod: "",
    dateFrom: "",
    dateTo: "",
  });
  const query = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "100" });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      return api<{ data: Transaction[] }>(`/transactions?${params}`);
    },
  });
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} />;
  const items = query.data!.data;
  return (
    <>
      <PageHeader
        title="Transaksi"
        description="Riwayat pembayaran dan audit void."
      />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <input
          className="field"
          placeholder="Cari invoice..."
          value={filters.invoiceNo}
          onChange={(event) =>
            setFilters({ ...filters, invoiceNo: event.target.value })
          }
        />
        <select
          className="field"
          value={filters.status}
          onChange={(event) =>
            setFilters({ ...filters, status: event.target.value })
          }
        >
          <option value="">Semua status</option>
          <option value="PAID">PAID</option>
          <option value="VOID">VOID</option>
        </select>
        <select
          className="field"
          value={filters.paymentMethod}
          onChange={(event) =>
            setFilters({ ...filters, paymentMethod: event.target.value })
          }
        >
          <option value="">Semua pembayaran</option>
          <option value="CASH">CASH</option>
          <option value="QRIS">QRIS</option>
          <option value="TRANSFER">TRANSFER</option>
        </select>
        <input
          className="field"
          type="date"
          value={filters.dateFrom}
          onChange={(event) =>
            setFilters({ ...filters, dateFrom: event.target.value })
          }
        />
        <input
          className="field"
          type="date"
          value={filters.dateTo}
          onChange={(event) =>
            setFilters({ ...filters, dateTo: event.target.value })
          }
        />
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[#eadfd3] bg-[#fff8f1] text-xs text-[#796c63]">
            <tr>
              <th className="p-4">INVOICE</th>
              <th className="p-4">WAKTU</th>
              <th className="p-4">KASIR</th>
              <th className="p-4">PEMBAYARAN</th>
              <th className="p-4">STATUS</th>
              <th className="p-4 text-right">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-[#f1e8df] hover:bg-orange-50/40"
              >
                <td className="p-4">
                  <Link
                    className="font-black text-[#e7562c]"
                    href={`/transactions/${item.id}`}
                  >
                    {item.invoiceNo}
                  </Link>
                </td>
                <td className="p-4">{dateTime(item.paidAt)}</td>
                <td className="p-4">{item.cashier.name}</td>
                <td className="p-4 font-bold">{item.paymentMethod}</td>
                <td className="p-4">
                  <StatusBadge status={item.status} />
                </td>
                <td className="p-4 text-right font-black">
                  {rupiah(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!items.length && <Empty>Belum ada transaksi.</Empty>}
    </>
  );
}
