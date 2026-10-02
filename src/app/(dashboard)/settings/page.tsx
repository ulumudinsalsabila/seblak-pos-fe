"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2 } from "lucide-react";
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
          storeName: form?.storeName,
          logoUrl: form?.logoUrl || null,
          faviconUrl: form?.faviconUrl || null,
          phone: form?.phone,
          address: form?.address,
          currency: form?.currency,
          taxEnabled: form?.taxEnabled,
          taxPercentage: Number(form?.taxPercentage ?? 0),
          receiptPaperSize: form?.receiptPaperSize,
          receiptHeader: form?.receiptHeader,
          receiptFooter: form?.receiptFooter,
        }),
      }),
    onSuccess: () => {
      setForm(null);
      void client.invalidateQueries({ queryKey: ["settings"] });
      void client.invalidateQueries({ queryKey: ["branding"] });
    },
  });
  const uploadImage = useMutation({
    mutationFn: async ({
      file,
      field,
    }: {
      file: File;
      field: "logoUrl" | "faviconUrl";
    }) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Gambar harus berformat JPEG, PNG, atau WebP");
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error("Ukuran gambar maksimal 2 MB");
      }
      const signed = await api<{
        data: {
          cloudName: string;
          apiKey: string;
          timestamp: number;
          folder: string;
          signature: string;
        };
      }>("/settings/image-signature", { method: "POST" });
      const body = new FormData();
      body.append("file", file);
      body.append("api_key", signed.data.apiKey);
      body.append("timestamp", String(signed.data.timestamp));
      body.append("folder", signed.data.folder);
      body.append("signature", signed.data.signature);
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${signed.data.cloudName}/image/upload`,
        { method: "POST", body },
      );
      const uploaded = (await response.json()) as {
        secure_url?: string;
        error?: { message?: string };
      };
      if (!response.ok || !uploaded.secure_url) {
        throw new Error(uploaded.error?.message ?? "Upload gambar gagal");
      }
      return { field, url: uploaded.secure_url };
    },
    onSuccess: ({ field, url }) => {
      setForm((current) => ({ ...(current ?? form!), [field]: url }));
    },
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
        <section>
          <h2 className="text-lg font-black">Identitas visual</h2>
          <p className="mt-1 text-sm text-[#796c63]">
            Logo tampil di aplikasi. Favicon tampil pada tab browser web dan
            mobile.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["logoUrl", "LOGO APLIKASI", "Disarankan PNG/WebP persegi"],
                [
                  "faviconUrl",
                  "FAVICON BROWSER",
                  "Disarankan PNG persegi 512×512",
                ],
              ] as const
            ).map(([field, label, help]) => {
              const imageUrl = form[field];
              return (
                <div
                  key={field}
                  className="rounded-2xl border border-[#eadfd3] bg-[#fffaf5] p-4"
                >
                  <span className="label">{label}</span>
                  <div className="mt-2 flex items-center gap-4">
                    <div
                      className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-[#eadfd3] bg-white bg-contain bg-center bg-no-repeat text-[#b9a99c]"
                      style={
                        imageUrl
                          ? { backgroundImage: `url(${imageUrl})` }
                          : undefined
                      }
                    >
                      {!imageUrl && <ImagePlus size={28} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-2 text-xs text-[#796c63]">
                        {help}, maksimal 2 MB.
                      </p>
                      <label className="btn-ghost relative inline-flex cursor-pointer items-center text-sm">
                        <input
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={uploadImage.isPending}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) uploadImage.mutate({ file, field });
                            event.target.value = "";
                          }}
                        />
                        {uploadImage.isPending &&
                        uploadImage.variables?.field === field
                          ? "Mengunggah..."
                          : imageUrl
                            ? "Ganti gambar"
                            : "Pilih gambar"}
                      </label>
                      {imageUrl && (
                        <button
                          type="button"
                          className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-red-600"
                          onClick={() => setForm({ ...form, [field]: "" })}
                        >
                          <Trash2 size={13} /> Hapus
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <hr className="border-[#eadfd3]" />
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
        {uploadImage.error && <ErrorNotice error={uploadImage.error} />}
        {save.error && <ErrorNotice error={save.error} />}
        <button
          className="btn-primary"
          disabled={save.isPending || uploadImage.isPending}
        >
          {save.isPending ? "Menyimpan..." : "Simpan pengaturan"}
        </button>
      </form>
    </>
  );
}
