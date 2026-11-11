"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { FormInput, SearchSelect } from "@/components/form-controls";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { api } from "@/lib/api";
import type { InventoryItem, StockLocation, StockRequest } from "@/lib/types";
import { dateTime, Feedback, PageResult, Pager, quantity } from "../inventory-ui";
import { blankItemLine, ItemLine, ItemLinesEditor, linesDuplicated, linesIncomplete, RequestStatusBadge, requestStatusLabel } from "../transfer-ui";

export default function InventoryRequestsPage() {
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
  const [approved, setApproved] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const isOwner = user?.role === "OWNER";
  const locations = useQuery({ queryKey: ["inventory-locations", "request"], queryFn: () => api<PageResult<StockLocation>>("/inventory/locations?page=1&limit=100&status=ACTIVE") });
  const items = useQuery({ queryKey: ["inventory-items", "request"], queryFn: () => api<PageResult<InventoryItem>>("/inventory/items?page=1&limit=100&status=ACTIVE") });
  const requests = useQuery({
    queryKey: ["inventory-requests", status, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "10" });
      if (status) params.set("status", status);
      return api<PageResult<StockRequest>>(`/inventory/requests?${params}`);
    },
  });

  async function refresh() {
    await Promise.all(["inventory-requests", "inventory-transfers"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (linesDuplicated(lines)) {
      setError("Item yang sama tidak boleh diminta dua kali.");
      return;
    }
    setSubmitting(true);
    try {
      await api("/inventory/requests", {
        method: "POST",
        body: JSON.stringify({ clientRequestId: requestId, sourceLocationId, destinationLocationId, ...(notes.trim() ? { notes: notes.trim() } : {}), lines: lines.map(({ itemId, quantity: lineQuantity }) => ({ itemId, quantity: lineQuantity })) }),
      });
      setRequestId(crypto.randomUUID());
      setLines([blankItemLine()]);
      setNotes("");
      setPage(1);
      setMessage("Request stok terkirim dan menunggu persetujuan owner.");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengirim request.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggle(request: StockRequest) {
    setOpenId(openId === request.id ? "" : request.id);
    setApproved(Object.fromEntries(request.lines.map((line) => [line.item.id, line.quantity])));
    setReason("");
  }

  async function act(request: StockRequest, action: "approve" | "reject" | "cancel") {
    if (action === "cancel" && !window.confirm("Batalkan request ini?")) return;
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const body =
        action === "approve"
          ? { lines: Object.entries(approved).map(([itemId, lineQuantity]) => ({ itemId, quantity: lineQuantity || "0" })) }
          : action === "reject"
            ? { reason: reason.trim() }
            : {};
      await api(`/inventory/requests/${request.id}/${action}`, { method: "POST", body: JSON.stringify(body) });
      setMessage(action === "approve" ? "Request disetujui. Transfer dibuat dan siap dikirim." : action === "reject" ? "Request ditolak." : "Request dibatalkan.");
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
      <PageHeader title="Request stok" description="Minta kiriman stok dari gudang atau lokasi lain. Setelah disetujui owner, request menjadi transfer yang siap dikirim." />
      <Feedback message={message} error={error} />
      <form className="card mb-8 space-y-4 p-4" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-3">
          <SearchSelect label="Minta dari" value={sourceLocationId} options={locationOptions} onChange={setSourceLocationId} />
          <SearchSelect label="Kirim ke" value={destinationLocationId} options={locationOptions} onChange={setDestinationLocationId} />
          <FormInput label="Catatan" maxLength={500} placeholder="Opsional" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
        {sourceLocationId && sourceLocationId === destinationLocationId && <p className="text-sm text-red-600">Lokasi asal dan tujuan harus berbeda.</p>}
        <ItemLinesEditor lines={lines} items={items.data?.data ?? []} onChange={setLines} />
        <div className="flex justify-end"><button className="btn-primary" disabled={submitting || incomplete}><Send size={17} /> {submitting ? "Mengirim..." : "Kirim request"}</button></div>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black">Daftar request</h2>
        <SearchSelect className="w-60" value={status} clearable placeholder="Semua status" options={Object.entries(requestStatusLabel).map(([value, label]) => ({ value, label }))} onChange={(value) => { setStatus(value); setPage(1); }} />
      </div>
      {requests.isLoading && <Loading label="Memuat request..." />}
      {requests.error && <ErrorNotice error={requests.error} />}
      {!requests.isLoading && !requests.data?.data.length && <Empty>Belum ada request stok.</Empty>}
      {!!requests.data?.data.length && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-4">DIMINTA</th><th className="p-4">DARI → KE</th><th className="p-4">ITEM</th><th className="p-4">STATUS</th><th className="p-4" /></tr></thead>
            <tbody>
              {requests.data.data.map((request) => (
                <Fragment key={request.id}>
                  <tr className="border-b border-border align-top">
                    <td className="whitespace-nowrap p-4">{dateTime(request.requestedAt)}<p className="text-xs text-muted-foreground">{request.requestedBy?.name ?? "—"}</p></td>
                    <td className="p-4">{request.sourceLocation.name} → {request.destinationLocation.name}{request.notes && <p className="text-xs text-muted-foreground">{request.notes}</p>}</td>
                    <td className="p-4">{request.lines.map((line) => <p key={line.id}>{quantity(line.quantity, 6)} {line.item.baseUnit.symbol} {line.item.name}{line.approvedQuantity != null && line.approvedQuantity !== line.quantity && <span className="text-xs text-muted-foreground"> (disetujui {quantity(line.approvedQuantity, 6)})</span>}</p>)}</td>
                    <td className="p-4"><RequestStatusBadge status={request.status} />{request.reviewNotes && <p className="mt-1 text-xs text-muted-foreground">{request.reviewNotes}</p>}{request.transfer && <Link className="mt-1 block text-xs font-bold text-primary hover:underline" href="/inventory/transfers">Lihat transfer</Link>}</td>
                    <td className="p-4 text-right">{request.status === "SUBMITTED" && <button type="button" className="btn-ghost !min-h-9 !px-3" onClick={() => toggle(request)}>{openId === request.id ? "Tutup" : isOwner ? "Tinjau" : "Kelola"}</button>}</td>
                  </tr>
                  {openId === request.id && (
                    <tr className="border-b border-border bg-muted/30">
                      <td colSpan={5} className="space-y-4 p-4">
                        {isOwner && (
                          <>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              {request.lines.map((line) => <FormInput key={line.id} label={`Disetujui: ${line.item.name} (${line.item.baseUnit.symbol})`} inputMode="decimal" value={approved[line.item.id] ?? ""} onChange={(event) => setApproved((current) => ({ ...current, [line.item.id]: event.target.value }))} />)}
                            </div>
                            <p className="text-xs text-muted-foreground">Kurangi jumlah kalau stok gudang tidak cukup. Isi 0 untuk tidak mengirim item itu.</p>
                            <div className="flex flex-wrap items-end gap-3">
                              <button type="button" className="btn-primary" disabled={!!busy} onClick={() => act(request, "approve")}><CheckCircle2 size={17} /> {busy === "approve" ? "Menyetujui..." : "Setujui & buat transfer"}</button>
                              <FormInput label="Alasan tolak" placeholder="Minimal 3 karakter" value={reason} onChange={(event) => setReason(event.target.value)} />
                              <button type="button" className="btn-ghost text-red-600" disabled={reason.trim().length < 3 || !!busy} onClick={() => act(request, "reject")}><XCircle size={17} /> Tolak</button>
                            </div>
                          </>
                        )}
                        <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => act(request, "cancel")}>Batalkan request</button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {requests.data?.meta && <Pager page={requests.data.meta.page} totalPages={requests.data.meta.totalPages} disabled={requests.isFetching} onChange={setPage} />}
    </>
  );
}
