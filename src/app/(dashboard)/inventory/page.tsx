"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, MapPin, PackageX } from "lucide-react";
import { useEffect, useState } from "react";
import { SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import type {
  InventoryOverview,
  StockBalance,
  StockLocation,
} from "@/lib/types";

type Page<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState<"ALL" | "LOW" | "OUT">("ALL");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const overview = useQuery({
    queryKey: ["inventory-overview"],
    queryFn: () => api<{ data: InventoryOverview }>("/inventory/overview"),
  });
  const locations = useQuery({
    queryKey: ["inventory-locations"],
    queryFn: () =>
      api<Page<StockLocation>>(
        "/inventory/locations?page=1&limit=100&status=ACTIVE",
      ),
  });
  const balances = useQuery({
    queryKey: [
      "inventory-balances",
      debouncedSearch,
      locationId,
      status,
      page,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        status,
        sortBy: "name",
        sortOrder: "asc",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (locationId) params.set("locationId", locationId);
      return api<Page<StockBalance>>(`/inventory/balances?${params}`);
    },
    placeholderData: keepPreviousData,
  });

  if (overview.isLoading || locations.isLoading || balances.isLoading)
    return <Loading label="Memuat inventory..." />;
  if (overview.error) return <ErrorNotice error={overview.error} />;
  if (locations.error) return <ErrorNotice error={locations.error} />;
  if (balances.error && !balances.data)
    return <ErrorNotice error={balances.error} />;

  const summary = overview.data!.data;
  const meta = balances.data?.meta;
  const cards = [
    { label: "Item aktif", value: summary.activeItems, icon: Boxes },
    { label: "Lokasi", value: summary.activeLocations, icon: MapPin },
    { label: "Stok menipis", value: summary.lowStock, icon: AlertTriangle },
    { label: "Stok habis", value: summary.outOfStock, icon: PackageX },
  ];

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Saldo stok per lokasi dengan ledger yang terisolasi per tenant."
      />

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div className="card p-4 sm:p-5" key={label}>
            <Icon className="text-[var(--brand)]" size={22} />
            <p className="mt-4 text-sm font-bold text-[#796c63]">{label}</p>
            <p className="mt-1 text-2xl font-black">{value}</p>
          </div>
        ))}
      </section>

      <section className="card mt-4 p-4 sm:mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-black">Valuasi stok</p>
            <p className="mt-1 text-2xl font-black text-[var(--brand)]">
              {summary.totalStockValue === undefined
                ? "Akses terbatas"
                : rupiah(Math.round(Number(summary.totalStockValue)))}
            </p>
          </div>
          <span
            className={`badge ${
              summary.costCoverage.complete
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {summary.costCoverage.complete
              ? "Cost lengkap"
              : `${summary.costCoverage.missingCosts} saldo belum memiliki cost`}
          </span>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <input
            className="field"
            placeholder="Cari item atau SKU..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <SearchSelect
            value={locationId}
            clearable
            placeholder="Semua lokasi"
            searchPlaceholder="Cari lokasi..."
            options={(locations.data?.data ?? []).map((location) => ({
              value: location.id,
              label: location.name,
              description: `${location.code} · ${location.type}`,
            }))}
            onChange={(value) => {
              setLocationId(value);
              setPage(1);
            }}
          />
          <SearchSelect
            value={status}
            options={[
              { value: "ALL", label: "Semua saldo" },
              { value: "LOW", label: "Stok menipis" },
              { value: "OUT", label: "Stok habis" },
            ]}
            onChange={(value) => {
              setStatus(value as "ALL" | "LOW" | "OUT");
              setPage(1);
            }}
          />
        </div>

        {balances.error && <ErrorNotice error={balances.error} />}
        <div className="space-y-3 md:hidden">
          {(balances.data?.data ?? []).map((balance) => (
            <article className="card p-4" key={balance.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black">{balance.item.name}</p>
                  <p className="mt-1 text-xs text-[#796c63]">
                    {balance.item.sku} · {balance.location.name}
                  </p>
                </div>
                <p className="shrink-0 font-black text-[var(--brand)]">
                  {Number(balance.quantity).toLocaleString("id-ID")} {balance.item.baseUnit.symbol}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="card hidden overflow-hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[#eadfd3] bg-[#fff8f1] text-xs text-[#796c63]">
                <tr>
                  <th className="p-4">ITEM</th>
                  <th className="p-4">LOKASI</th>
                  <th className="p-4 text-right">SALDO</th>
                  <th className="p-4 text-right">REORDER</th>
                  <th className="p-4 text-right">AVG COST</th>
                </tr>
              </thead>
              <tbody>
                {(balances.data?.data ?? []).map((balance) => (
                  <tr className="border-b border-[#f1e8df]" key={balance.id}>
                    <td className="p-4">
                      <p className="font-black">{balance.item.name}</p>
                      <p className="text-xs text-[#796c63]">{balance.item.sku}</p>
                    </td>
                    <td className="p-4">{balance.location.name}</td>
                    <td className="p-4 text-right font-black">
                      {Number(balance.quantity).toLocaleString("id-ID")} {balance.item.baseUnit.symbol}
                    </td>
                    <td className="p-4 text-right">
                      {Number(balance.item.reorderPoint).toLocaleString("id-ID")}
                    </td>
                    <td className="p-4 text-right">
                      {balance.averageUnitCost === undefined
                        ? "—"
                        : rupiah(Math.round(Number(balance.averageUnitCost)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!balances.data?.data.length && (
          <Empty>Belum ada saldo inventory sesuai filter.</Empty>
        )}
        {meta && meta.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-[#796c63]">
              Halaman {meta.page} dari {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                className="btn-ghost"
                disabled={page <= 1 || balances.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Sebelumnya
              </button>
              <button
                className="btn-ghost"
                disabled={page >= meta.totalPages || balances.isFetching}
                onClick={() =>
                  setPage((current) => Math.min(meta.totalPages, current + 1))
                }
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
