"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Settings } from "@/lib/types";
import { ErrorNotice, Loading, PageHeader } from "@/components/ui";
export default function SettingsPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ data: Settings }>("/settings"),
  });
  const [draft, setForm] = useState<Settings | null>(null);
  const form = draft ?? query.data?.data ?? null;
  const save = useMutation({
    mutationFn: () =>
      api("/settings", {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          taxPercentage: Number(form?.taxPercentage ?? 0),
        }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["settings"] }),
  });
  if (query.isLoading || !form) return <Loading />;
  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  return (
    <>
      <PageHeader
        title="Pengaturan toko"
        description="Konfigurasi pajak dan identitas untuk transaksi berikutnya."
      />
      <form onSubmit={submit} className="card mx-auto max-w-3xl space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">NAMA TOKO</span>
            <input
              className="field"
              value={form.storeName}
              onChange={(e) => setForm({ ...form, storeName: e.target.value })}
            />
          </label>
          <label>
            <span className="label">TELEPON</span>
            <input
              className="field"
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
        </div>
        <label>
          <span className="label">ALAMAT</span>
          <textarea
            className="field"
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <span className="label">MATA UANG</span>
            <input
              className="field"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            />
          </label>
          <label>
            <span className="label">UKURAN STRUK</span>
            <select
              className="field"
              value={form.receiptPaperSize}
              onChange={(e) =>
                setForm({
                  ...form,
                  receiptPaperSize: e.target
                    .value as Settings["receiptPaperSize"],
                })
              }
            >
              <option value="MM58">58 MM</option>
              <option value="MM80">80 MM</option>
            </select>
          </label>
          <label>
            <span className="label">PAJAK (%)</span>
            <input
              className="field"
              type="number"
              min={0}
              max={100}
              step="0.01"
              disabled={!form.taxEnabled}
              value={form.taxPercentage}
              onChange={(e) =>
                setForm({ ...form, taxPercentage: e.target.value })
              }
            />
          </label>
        </div>
        <label className="flex items-center gap-2 font-bold">
          <input
            type="checkbox"
            checked={form.taxEnabled}
            onChange={(e) => setForm({ ...form, taxEnabled: e.target.checked })}
          />
          Aktifkan pajak
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">HEADER STRUK</span>
            <textarea
              className="field"
              value={form.receiptHeader ?? ""}
              onChange={(e) =>
                setForm({ ...form, receiptHeader: e.target.value })
              }
            />
          </label>
          <label>
            <span className="label">FOOTER STRUK</span>
            <textarea
              className="field"
              value={form.receiptFooter ?? ""}
              onChange={(e) =>
                setForm({ ...form, receiptFooter: e.target.value })
              }
            />
          </label>
        </div>
        {save.error && <ErrorNotice error={save.error} />}
        <button className="btn-primary" disabled={save.isPending}>
          {save.isPending ? "Menyimpan..." : "Simpan pengaturan"}
        </button>
      </form>
    </>
  );
}
