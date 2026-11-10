"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { cn } from "@/lib/utils";

export type PageResult<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

const inventoryLinks = [
  { href: "/inventory", label: "Ringkasan", roles: ["OWNER", "MANAGER"] },
  { href: "/inventory/items", label: "Item stok", roles: ["OWNER", "MANAGER"] },
  { href: "/inventory/locations", label: "Lokasi", roles: ["OWNER", "MANAGER"] },
  { href: "/inventory/units", label: "Satuan", roles: ["OWNER", "MANAGER"] },
  { href: "/inventory/opening-balances", label: "Saldo awal", roles: ["OWNER"] },
  { href: "/inventory/movements", label: "Kartu stok", roles: ["OWNER", "MANAGER"] },
];

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
  PURCHASE_RECEIPT: "Penerimaan pembelian",
  SALE_CONSUMPTION: "Pemakaian penjualan",
  ADJUSTMENT_IN: "Penyesuaian masuk",
  ADJUSTMENT_OUT: "Penyesuaian keluar",
  TRANSFER_OUT: "Transfer keluar",
  TRANSFER_IN: "Transfer masuk",
  PREPARATION_CONSUMPTION: "Pemakaian produksi",
  PREPARATION_OUTPUT: "Hasil produksi",
  WASTE: "Waste",
  RETURN_IN: "Retur masuk",
  RETURN_OUT: "Retur keluar",
};
