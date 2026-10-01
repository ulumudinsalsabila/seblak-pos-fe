"use client";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CircleDollarSign,
  Flame,
  ReceiptText,
  ShoppingBag,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { dateTime, rupiah } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { ErrorNotice, Loading, PageHeader, StatusBadge } from "@/components/ui";

type DashboardData = {
  summary: {
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
  recentTransactions: Transaction[];
  topProducts: Array<{
    productName: string;
    _sum: { quantity: number; subtotal: number };
  }>;
};
export default function DashboardPage() {
  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<{ data: DashboardData }>("/dashboard"),
  });
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} />;
  const data = query.data!.data;
  const cards = [
    {
      label: "Omzet terkumpul",
      value: rupiah(data.summary.collected),
      icon: CircleDollarSign,
      color: "bg-orange-100 text-orange-700",
    },
    {
      label: "Transaksi",
      value: String(data.summary.transactionCount),
      icon: ReceiptText,
      color: "bg-blue-100 text-blue-700",
    },
    {
      label: "Rata-rata order",
      value: rupiah(data.summary.averageOrderValue),
      icon: ShoppingBag,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Net cashflow",
      value: rupiah(data.summary.netCashflow),
      icon: WalletCards,
      color: "bg-violet-100 text-violet-700",
    },
  ];
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan outlet hari ini, waktu Asia/Jakarta."
        action={
          <Link href="/pos" className="btn-primary">
            Buka kasir
          </Link>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="card p-5" key={card.label}>
              <div className={`mb-5 inline-flex rounded-xl p-3 ${card.color}`}>
                <Icon size={22} />
              </div>
              <p className="text-sm font-bold text-[#796c63]">{card.label}</p>
              <p className="mt-2 text-2xl font-black">{card.value}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.8fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#eadfd3] p-5">
            <h2 className="font-black">Transaksi terbaru</h2>
            <Link
              href="/transactions"
              className="text-sm font-bold text-[#e7562c]"
            >
              Lihat semua
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {data.recentTransactions.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[#f1e8df] last:border-0"
                  >
                    <td className="p-4">
                      <Link
                        href={`/transactions/${item.id}`}
                        className="font-black hover:text-[#e7562c]"
                      >
                        {item.invoiceNo}
                      </Link>
                      <p className="mt-1 text-xs text-[#796c63]">
                        {dateTime(item.paidAt)}
                      </p>
                    </td>
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
            {!data.recentTransactions.length && (
              <p className="p-8 text-center text-[#796c63]">
                Belum ada transaksi hari ini.
              </p>
            )}
          </div>
        </section>
        <section className="card p-5">
          <div className="mb-5 flex items-center gap-2">
            <Flame className="text-[#e7562c]" />
            <h2 className="font-black">Produk terlaris</h2>
          </div>
          <div className="space-y-4">
            {data.topProducts.map((item, index) => (
              <div key={item.productName} className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[#fff0e8] text-sm font-black text-[#e7562c]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{item.productName}</p>
                  <p className="text-xs text-[#796c63]">
                    {item._sum.quantity} item
                  </p>
                </div>
                <ArrowUpRight size={17} className="text-[#477a52]" />
              </div>
            ))}
            {!data.topProducts.length && (
              <p className="text-sm text-[#796c63]">
                Belum ada data penjualan.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
