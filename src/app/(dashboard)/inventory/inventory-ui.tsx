"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import type { InventoryItem, InventoryUnit } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PageResult<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

const inventoryLinks = [
  { href: "/inventory", label: "Ringkasan", roles: ["OWNER", "MANAGER"] },
  { href: "/inventory/items", label: "Item stok", roles: ["OWNER", "MANAGER"] },
  { href: "/inventory/recipes", label: "Resep", roles: ["OWNER", "MANAGER"] },
  { href: "/inventory/menu-options", label: "Bahan opsi menu", roles: ["OWNER", "MANAGER"] },
  { href: "/inventory/locations", label: "Lokasi", roles: ["OWNER", "MANAGER"] },
  { href: "/inventory/units", label: "Satuan", roles: ["OWNER", "MANAGER"] },
  { href: "/inventory/opening-balances", label: "Saldo awal", roles: ["OWNER"] },
  { href: "/inventory/purchases", label: "Pembelian", roles: ["OWNER", "MANAGER"] },
  { href: "/inventory/adjustments", label: "Waste & penyesuaian", roles: ["OWNER", "MANAGER"] },
  { href: "/inventory/stocktakes", label: "Stock opname", roles: ["OWNER", "MANAGER"] },
  { href: "/inventory/movements", label: "Kartu stok", roles: ["OWNER", "MANAGER"] },
];

/** Units stock of this item can be entered in: its base unit, units of the same dimension, and its active conversions. */
export function receivingUnits(item: InventoryItem | undefined, units: InventoryUnit[]) {
  if (!item) return [];
  const converted = (item.conversions ?? []).filter((conversion) => !conversion.validTo).map((conversion) => conversion.unit);
  const sameDimension = units.filter((unit) => unit.dimension === item.baseUnit.dimension);
  return [item.baseUnit, ...sameDimension, ...converted].filter((unit, index, all) => all.findIndex((other) => other.id === unit.id) === index);
}

export function InventoryNav() {
  const path = usePathname();
  const { user } = useAuth();
  return (
    <nav className="mb-6 overflow-x-auto" aria-label="Menu inventory">
      <div className="flex min-w-max gap-1 rounded-xl border border-border bg-card p-1">
        {inventoryLinks.filter((link) => user && link.roles.includes(user.role as "OWNER" | "MANAGER")).map((link) => {
          const active =
            link.href === "/inventory"
              ? path === link.href
              : path === link.href || path.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Pager({
  page,
  totalPages,
  disabled,
  onChange,
}: {
  page: number;
  totalPages: number;
  disabled?: boolean;
  onChange(page: number): void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Halaman {page} dari {totalPages}
      </p>
      <div className="flex gap-2">
        <button
          className="btn-ghost"
          disabled={disabled || page <= 1}
          onClick={() => onChange(Math.max(1, page - 1))}
        >
          Sebelumnya
        </button>
        <button
          className="btn-ghost"
          disabled={disabled || page >= totalPages}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
        >
          Berikutnya
        </button>
      </div>
    </div>
  );
}

export function Feedback({
  message,
  error,
}: {
  message?: string;
  error?: string;
}) {
  if (!message && !error) return null;
  return (
    <div
      className={cn(
        "mb-4 rounded-xl border p-3 text-sm font-semibold",
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      )}
    >
      {error ?? message}
    </div>
  );
}

export function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), delay);
    return () => clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

export function quantity(value: string | number, precision = 3) {
  return Number(value).toLocaleString("id-ID", {
    maximumFractionDigits: precision,
  });
}

export function dateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export const itemTypeLabel = {
  INGREDIENT: "Bahan baku",
  SEMI_FINISHED: "Barang setengah jadi",
  PACKAGED: "Barang kemasan",
} as const;

export const locationTypeLabel = {
  WAREHOUSE: "Gudang",
  OUTLET: "Outlet",
  KITCHEN: "Dapur",
  OTHER: "Lainnya",
} as const;

export const movementTypeLabel: Record<string, string> = {
  OPENING_BALANCE: "Saldo awal",
  PURCHASE_RECEIVED: "Penerimaan pembelian",
  SALE_CONSUMED: "Pemakaian penjualan",
  SALE_REVERSED: "Pembatalan penjualan",
  PREP_ISSUED: "Pemakaian produksi",
  PREP_RECEIVED: "Hasil produksi",
  TRANSFER_SHIPPED: "Transfer keluar",
  TRANSFER_RECEIVED: "Transfer masuk",
  WASTE_POSTED: "Waste",
  ADJUSTMENT_POSTED: "Penyesuaian",
  STOCKTAKE_VARIANCE_POSTED: "Selisih stock opname",
};

export const adjustmentReasonLabel: Record<string, string> = {
  EXPIRED: "Kedaluwarsa",
  SPOILED: "Basi / rusak",
  SPILLED: "Tumpah",
  DAMAGED: "Rusak fisik",
  STAFF_MEAL: "Makan karyawan",
  COUNT_CORRECTION: "Koreksi hitungan",
  FOUND: "Ditemukan",
  OTHER: "Lainnya",
  VOIDED_ORDER: "Pesanan di-void",
};

export const stocktakeStatusLabel: Record<string, string> = {
  COUNTING: "Menghitung",
  REVIEW: "Menunggu persetujuan",
  POSTED: "Diposting",
  CANCELLED: "Dibatalkan",
};

/** Signed rupiah value, e.g. "+Rp 1.200" or "−Rp 800". */
export function signedRupiah(value: string | number, format: (value: number) => string) {
  const amount = Math.round(Number(value));
  if (amount === 0) return format(0);
  return `${amount > 0 ? "+" : "−"}${format(Math.abs(amount))}`;
}
