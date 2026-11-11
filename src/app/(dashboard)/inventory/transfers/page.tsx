"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageCheck, Truck } from "lucide-react";
import { Fragment, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { FormInput, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import type { InventoryItem, StockLocation, StockTransfer } from "@/lib/types";

import { dateTime, Feedback, PageResult, Pager, quantity } from "../inventory-ui";
import { blankItemLine, ItemLine, ItemLinesEditor, linesDuplicated, linesIncomplete, TransferStatusBadge, transferStatusLabel } from "../transfer-ui";

type Line = StockTransfer["lines"][number];
const inTransit = (line: Line) => Number(line.shippedQuantity) - Number(line.receivedQuantity) - Number(line.lostQuantity);
/** Plain decimal string without float noise. */
const plain = (value: number) => String(Number(value.toFixed(6)));

export default function InventoryTransfersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [sourceLocationId, setSourceLocationId] = useState("");
  const [destinationLocationId, setDestinationLocationId] = useState("");
  const [lines, setLines] = useState<ItemLine[]>([blankItemLine()]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [receiptId, setReceiptId] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const isOwner = user?.role === "OWNER";
  const locations = useQuery({ queryKey: ["inventory-locations", "transfer"], queryFn: () => api<PageResult<StockLocation>>("/inventory/locations?page=1&limit=100&status=ACTIVE") });
  const items = useQuery({ queryKey: ["inventory-items", "transfer"], queryFn: () => api<PageResult<InventoryItem>>("/inventory/items?page=1&limit=100&status=ACTIVE") });
  const transfers = useQuery({
    queryKey: ["inventory-transfers", status, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (status) params.set("status", status);
      return api<PageResult<StockTransfer>>(`/inventory/transfers?${params}`);
    },
  });

  async function refresh() {
    await Promise.all(["inventory-transfers", "inventory-requests", "inventory-overview", "inventory-balances", "inventory-movements"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (linesDuplicated(lines)) {
      setError("Item yang sama tidak boleh dicatat dua kali.");
      return;
    }
    setSubmitting(true);
    try {
      await api("/inventory/transfers", {
        method: "POST",
        body: JSON.stringify({ clientRequestId: requestId, sourceLocationId, destinationLocationId, ...(notes.trim() ? { notes: notes.trim() } : {}), lines: lines.map(({ itemId, quantity: lineQuantity }) => ({ itemId, quantity: lineQuantity })) }),
      });
      setRequestId(crypto.randomUUID());
      setLines([blankItemLine()]);
      setNotes("");
      setPage(1);
      setMessage("Transfer dibuat dan siap dikirim.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal membuat transfer.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggle(transfer: StockTransfer) {
    setOpenId(openId === transfer.id ? "" : transfer.id);
    // Ship defaults to the approved quantity, receive to what is still in transit.
    setAmounts(Object.fromEntries(transfer.lines.map((line) => [line.item.id, transfer.status === "APPROVED" ? line.quantity : plain(inTransit(line))])));
    setReceiptId(crypto.randomUUID());
    setReason("");
  }

  async function act(transfer: StockTransfer, action: "ship" | "receive" | "close" | "cancel") {
    if (action === "ship" && !window.confirm("Kirim transfer ini? Stok langsung keluar dari lokasi asal.")) return;
    if (action === "close" && !window.confirm("Tutup penerimaan? Sisa yang belum diterima dicatat hilang di perjalanan.")) return;
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const lineBody = Object.entries(amounts).map(([itemId, lineQuantity]) => ({ itemId, quantity: lineQuantity || "0" }));
      const body =
        action === "ship"
          ? { lines: lineBody }
          : action === "receive"
            ? { clientRequestId: receiptId, lines: lineBody.filter((line) => Number(line.quantity) > 0) }
            : { reason: reason.trim() };
      await api(`/inventory/transfers/${transfer.id}/${action}`, { method: "POST", body: JSON.stringify(body) });
      setMessage({ ship: "Transfer dikirim. Barang tercatat dalam perjalanan.", receive: "Penerimaan tercatat. Stok tujuan sudah bertambah.", close: "Penerimaan ditutup. Sisa dicatat hilang di perjalanan.", cancel: "Transfer dibatalkan." }[action]);
      setOpenId("");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aksi gagal.");
    } finally {
      setBusy("");
    }
  }

  if (locations.isLoading || items.isLoading) return <Loading label="Memuat master inventory..." />;
  if (locations.error) return <ErrorNotice error={locations.error} />;
  if (items.error) return <ErrorNotice error={items.error} />;
  const locationOptions = (locations.data?.data ?? []).map((location) => ({ value: location.id, label: location.name, description: location.code }));
  const incomplete = !sourceLocationId || !destinationLocationId || sourceLocationId === destinationLocationId || linesIncomplete(lines);

  return (
    <>
      <PageHeader title="Transfer stok" description="Pindahkan stok antar lokasi. Stok keluar dari asal saat dikirim, berstatus dalam perjalanan, lalu masuk ke tujuan saat diterima dengan harga pokok dari asal." />
      <Feedback message={message} error={error} />
      {isOwner && (
        <form className="card mb-8 space-y-4 p-4" onSubmit={create}>
          <h2 className="font-black">Transfer langsung</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <SearchSelect label="Dari" value={sourceLocationId} options={locationOptions} onChange={setSourceLocationId} />
            <SearchSelect label="Ke" value={destinationLocationId} options={locationOptions} onChange={setDestinationLocationId} />
            <FormInput label="Catatan" maxLength={500} placeholder="Opsional" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          {sourceLocationId && sourceLocationId === destinationLocationId && <p className="text-sm text-red-600">Lokasi asal dan tujuan harus berbeda.</p>}
          <ItemLinesEditor lines={lines} items={items.data?.data ?? []} onChange={setLines} />
          <div className="flex justify-end"><button className="btn-primary" disabled={submitting || incomplete}><Truck size={17} /> {submitting ? "Membuat..." : "Buat transfer"}</button></div>
        </form>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black">Daftar transfer</h2>
        <SearchSelect className="w-60" value={status} clearable placeholder="Semua status" options={Object.entries(transferStatusLabel).map(([value, label]) => ({ value, label }))} onChange={(value) => { setStatus(value); setPage(1); }} />
      </div>
      {transfers.isLoading && <Loading label="Memuat transfer..." />}
      {transfers.error && <ErrorNotice error={transfers.error} />}
      {!transfers.isLoading && !transfers.data?.data.length && <Empty>Belum ada transfer.</Empty>}
      {!!transfers.data?.data.length && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-4">DIBUAT</th><th className="p-4">DARI → KE</th><th className="p-4">ITEM (DISETUJUI · DIKIRIM · DITERIMA · HILANG)</th><th className="p-4">STATUS</th><th className="p-4" /></tr></thead>
            <tbody>
              {transfers.data.data.map((transfer) => {
                const actionable = transfer.status === "APPROVED" || transfer.status === "SHIPPED" || transfer.status === "PARTIALLY_RECEIVED";
                const shipping = transfer.status === "APPROVED";
                return (
                  <Fragment key={transfer.id}>
                    <tr className="border-b border-border align-top">
                      <td className="whitespace-nowrap p-4">{dateTime(transfer.createdAt)}<p className="text-xs text-muted-foreground">{transfer.createdBy?.name ?? "—"}{transfer.request ? " · dari request" : ""}</p></td>
                      <td className="p-4">{transfer.sourceLocation.name} → {transfer.destinationLocation.name}{transfer.shippedAt && <p className="text-xs text-muted-foreground">Dikirim {dateTime(transfer.shippedAt)} · {transfer.shippedBy?.name ?? "—"}</p>}</td>
                      <td className="p-4">
                        {transfer.lines.map((line) => {
                          const symbol = line.item.baseUnit.symbol;
                          const transit = inTransit(line);
                          return (
                            <p key={line.id}>
                              <span className="font-semibold">{line.item.name}</span> · {quantity(line.quantity, 6)} · {quantity(line.shippedQuantity, 6)} · {quantity(line.receivedQuantity, 6)}
                              {Number(line.lostQuantity) > 0 && <span className="text-red-600"> · {quantity(line.lostQuantity, 6)}</span>} {symbol}
                              {transit > 0 && <span className="text-xs text-sky-700"> ({quantity(transit, 6)} {symbol} di jalan)</span>}
                              {Number(line.lostQuantity) > 0 && line.unitCost != null && <span className="text-xs text-red-600"> rugi {rupiah(Number(line.lostQuantity) * Number(line.unitCost))}</span>}
                            </p>
                          );
                        })}
                      </td>
                      <td className="p-4"><TransferStatusBadge status={transfer.status} />{transfer.closeReason && <p className="mt-1 text-xs text-muted-foreground">{transfer.closeReason}</p>}</td>
                      <td className="p-4 text-right">{actionable && <button type="button" className="btn-ghost !min-h-9 !px-3" onClick={() => toggle(transfer)}>{openId === transfer.id ? "Tutup" : shipping ? "Kirim" : "Terima"}</button>}</td>
                    </tr>
                    {openId === transfer.id && (
                      <tr className="border-b border-border bg-muted/30">
                        <td colSpan={5} className="space-y-4 p-4">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {transfer.lines.filter((line) => shipping || inTransit(line) > 0).map((line) => (
                              <FormInput key={line.id} label={`${shipping ? "Dikirim" : "Diterima sekarang"}: ${line.item.name} (${line.item.baseUnit.symbol})`} inputMode="decimal" value={amounts[line.item.id] ?? ""} onChange={(event) => setAmounts((current) => ({ ...current, [line.item.id]: event.target.value }))} />
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">{shipping ? "Kurangi jumlah kalau tidak semua barang ikut dikirim. Isi 0 untuk tidak mengirim item itu." : "Catat yang benar-benar sampai. Sisanya tetap dalam perjalanan dan bisa diterima lagi nanti."}</p>
                          <div className="flex flex-wrap items-end gap-3">
                            {shipping ? (
                              <button type="button" className="btn-primary" disabled={!!busy} onClick={() => act(transfer, "ship")}><Truck size={17} /> {busy === "ship" ? "Mengirim..." : "Kirim sekarang"}</button>
                            ) : (
                              <button type="button" className="btn-primary" disabled={!!busy || !Object.values(amounts).some((value) => Number(value) > 0)} onClick={() => act(transfer, "receive")}><PackageCheck size={17} /> {busy === "receive" ? "Menyimpan..." : "Catat penerimaan"}</button>
                            )}
                            {isOwner && (
                              <>
                                <FormInput label={shipping ? "Alasan batal" : "Alasan tutup"} placeholder="Minimal 3 karakter" value={reason} onChange={(event) => setReason(event.target.value)} />
                                <button type="button" className="btn-ghost text-red-600" disabled={reason.trim().length < 3 || !!busy} onClick={() => act(transfer, shipping ? "cancel" : "close")}>{shipping ? "Batalkan transfer" : "Tutup, sisanya hilang"}</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {transfers.data?.meta && <Pager page={transfers.data.meta.page} totalPages={transfers.data.meta.totalPages} disabled={transfers.isFetching} onChange={setPage} />}
    </>
  );
}
