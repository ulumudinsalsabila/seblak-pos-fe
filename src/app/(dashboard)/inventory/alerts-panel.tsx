"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import Link from "next/link";
import { ErrorNotice } from "@/components/page-ui";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import type { InventoryAlerts } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dateTime, quantity } from "./inventory-ui";

type Severity = "critical" | "warning" | "info";
type Alert = { key: string; severity: Severity; title: string; detail: React.ReactNode; href: string; action: string };

const severityStyle: Record<Severity, { icon: typeof AlertOctagon; label: string; className: string }> = {
  critical: { icon: AlertOctagon, label: "Kritis", className: "border-red-200 bg-red-50 text-red-700" },
  warning: { icon: AlertTriangle, label: "Perhatian", className: "border-amber-200 bg-amber-50 text-amber-800" },
  info: { icon: Info, label: "Info", className: "border-sky-200 bg-sky-50 text-sky-700" },
};

const list = (names: string[], max = 4) => names.slice(0, max).join(", ") + (names.length > max ? `, +${names.length - max} lainnya` : "");

function buildAlerts(data: InventoryAlerts): Alert[] {
  const alerts: Alert[] = [];
  if (data.outOfStock.length)
    alerts.push({ key: "out", severity: "critical", title: `${data.outOfStock.length} stok habis`, detail: list(data.outOfStock.map((row) => `${row.name} (${row.location})`)), href: "/inventory/requests", action: "Minta stok" });
  if (data.lowStock.length)
    alerts.push({ key: "low", severity: "warning", title: `${data.lowStock.length} stok menipis`, detail: list(data.lowStock.map((row) => `${row.name} ${quantity(row.quantity)} ${row.unit}`)), href: "/inventory/purchases", action: "Catat pembelian" });
  const approvals = data.pendingApprovals;
  if (approvals.requests || approvals.stocktakes)
    alerts.push({
      key: "approvals",
      severity: "warning",
      title: "Menunggu persetujuan",
      detail: [approvals.requests ? `${approvals.requests} request stok` : "", approvals.stocktakes ? `${approvals.stocktakes} stock opname` : ""].filter(Boolean).join(" · "),
      href: approvals.requests ? "/inventory/requests" : "/inventory/stocktakes",
      action: "Tinjau",
    });
  if (data.staleTransfers.length)
    alerts.push({ key: "transit", severity: "warning", title: `${data.staleTransfers.length} transfer lebih dari 2 hari di jalan`, detail: list(data.staleTransfers.map((transfer) => `${transfer.sourceLocation.name} → ${transfer.destinationLocation.name}, dikirim ${dateTime(transfer.shippedAt)}`), 2), href: "/inventory/transfers", action: "Terima atau tutup" });
  if (approvals.unshippedTransfers)
    alerts.push({ key: "unshipped", severity: "info", title: `${approvals.unshippedTransfers} transfer disetujui belum dikirim`, detail: "Disetujui lebih dari sehari lalu.", href: "/inventory/transfers", action: "Kirim" });
  if (data.staleBatches.length)
    alerts.push({ key: "prep", severity: "warning", title: `${data.staleBatches.length} produksi belum diselesaikan`, detail: list(data.staleBatches.map((batch) => `${batch.outputItem.name} (${batch.location.name})`)), href: "/inventory/prep", action: "Selesaikan" });
  if (data.priceAnomalies.length)
    alerts.push({
      key: "price",
      severity: "info",
      title: `Harga beli berubah tajam pada ${data.priceAnomalies.length} bahan`,
      detail: list(data.priceAnomalies.map((anomaly) => `${anomaly.name} ${Number(anomaly.changePercent) > 0 ? "+" : ""}${quantity(anomaly.changePercent, 1)}%${anomaly.latestUnitCost ? ` (${rupiah(Number(anomaly.previousUnitCost))} → ${rupiah(Number(anomaly.latestUnitCost))}/${anomaly.unit})` : ""}`), 3),
      href: "/inventory/purchases",
      action: "Lihat pembelian",
    });
  if (data.missingCost)
    alerts.push({ key: "cost", severity: "info", title: `${data.missingCost} saldo stok belum punya harga pokok`, detail: "Food cost untuk item ini tidak bisa dihitung sampai ada saldo awal dengan cost atau pembelian.", href: "/inventory/opening-balances", action: "Isi saldo awal" });
  return alerts;
}

export function InventoryAlertsPanel() {
  const alerts = useQuery({ queryKey: ["inventory-alerts"], queryFn: () => api<{ data: InventoryAlerts }>("/inventory/alerts"), refetchInterval: 5 * 60 * 1000 });
  if (alerts.isLoading) return null;
  if (alerts.error) return <ErrorNotice error={alerts.error} />;
  const items = buildAlerts(alerts.data!.data);
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-lg font-black">Perlu perhatian</h2>
      {!items.length ? (
        <p className="card flex items-center gap-2 p-4 text-sm text-muted-foreground"><CheckCircle2 className="text-emerald-600" size={17} /> Tidak ada yang perlu ditindaklanjuti.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((alert) => {
            const { icon: Icon, label, className } = severityStyle[alert.severity];
            return (
              <article className="card flex items-start gap-3 p-4" key={alert.key}>
                <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold", className)}><Icon size={14} /> {label}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{alert.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{alert.detail}</p>
                </div>
                <Link className="shrink-0 text-sm font-bold text-primary hover:underline" href={alert.href}>{alert.action}</Link>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
