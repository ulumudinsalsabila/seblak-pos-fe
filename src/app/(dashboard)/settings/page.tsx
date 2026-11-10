"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Settings, TenantTheme } from "@/lib/types";
import { ErrorNotice, Loading, PageHeader } from "@/components/page-ui";
import { SearchSelect } from "@/components/form-controls";
import { useAuth } from "@/components/auth-provider";
import {
  contrastRatio,
  isHexColor,
  readableForeground,
} from "@/components/branding-provider";

type ThemeDraft = Pick<TenantTheme, "primaryColor" | "logoUrl" | "faviconUrl">;
type ImageField = "logoUrl" | "faviconUrl";

const imageFields = [
  ["logoUrl", "LOGO APLIKASI", "Disarankan PNG/WebP persegi"],
  ["faviconUrl", "FAVICON BROWSER", "Disarankan PNG persegi 512×512"],
] as const;

export default function SettingsPage() {
  const client = useQueryClient();
  const { user } = useAuth();
  const canEditTheme = user?.role === "OWNER";
  const query = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ data: Settings }>("/settings"),
  });
  const themeQuery = useQuery({
    queryKey: ["tenant-theme", user?.tenantId],
    queryFn: () => api<{ data: TenantTheme }>("/settings/theme"),
    enabled: Boolean(user?.tenantId),
  });
  const [draft, setForm] = useState<Settings | null>(null);
  const [themeDraft, setThemeDraft] = useState<ThemeDraft | null>(null);
  const form = draft ?? query.data?.data ?? null;
  const savedTheme = themeQuery.data?.data ?? null;
  const theme: ThemeDraft | null = themeDraft ?? savedTheme;
  const themeColorValid = isHexColor(theme?.primaryColor);
  const previewColor = themeColorValid
    ? theme!.primaryColor
    : (savedTheme?.primaryColor ?? "#C2410C");
  const previewForeground = readableForeground(previewColor);
  const previewContrast = contrastRatio(previewColor, previewForeground);

  // Only send what changed; omitted fields stay as they are on the server.
  function themeChanges() {
    if (!themeDraft || !savedTheme) return {};
    const changes: Partial<ThemeDraft> = {};
    if (themeDraft.primaryColor.toUpperCase() !== savedTheme.primaryColor.toUpperCase())
      changes.primaryColor = themeDraft.primaryColor.toUpperCase();
    for (const field of ["logoUrl", "faviconUrl"] as const) {
      const value = themeDraft[field]?.trim() || null;
      if (value !== savedTheme[field]) changes[field] = value;
    }
    return changes;
  }
  const pendingThemeChanges = Object.keys(themeChanges()).length > 0;

  const save = useMutation({
    mutationFn: () =>
      api("/settings", {
        method: "PATCH",
        body: JSON.stringify({
          storeName: form?.storeName,
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
    },
  });
  const saveTheme = useMutation({
    mutationFn: () =>
      api("/settings/theme", {
        method: "PATCH",
        body: JSON.stringify(themeChanges()),
      }),
    onSuccess: () => {
      setThemeDraft(null);
      void client.invalidateQueries({ queryKey: ["tenant-theme"] });
    },
  });
  const uploadImage = useMutation({
    mutationFn: async ({ file, field }: { file: File; field: ImageField }) => {
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
      setThemeDraft((current) => ({ ...(current ?? savedTheme!), [field]: url }));
    },
  });

  function editTheme(changes: Partial<ThemeDraft>) {
    setThemeDraft({ ...(theme ?? savedTheme!), ...changes });
  }

  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} />;
  if (!form) return <Loading />;
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
      <section className="card mx-auto mb-6 max-w-3xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Tema & logo tenant</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Berlaku untuk seluruh outlet{savedTheme ? ` ${savedTheme.tenantName}` : ""}: warna utama, logo aplikasi, dan favicon.
            </p>
            {!canEditTheme && (
              <p className="mt-2 text-sm font-bold text-amber-700">
                Hanya owner yang dapat mengubah tema.
              </p>
            )}
          </div>
          {canEditTheme && theme && (
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" disabled={!themeDraft || saveTheme.isPending} onClick={() => { setThemeDraft(null); saveTheme.reset(); }}>Batal</button>
              <button type="button" className="btn-primary" disabled={!pendingThemeChanges || !themeColorValid || saveTheme.isPending || uploadImage.isPending} onClick={() => saveTheme.mutate()}>{saveTheme.isPending ? "Menyimpan..." : "Simpan tema"}</button>
            </div>
          )}
        </div>
        {themeQuery.isLoading && <Loading label="Memuat tema..." />}
        {themeQuery.error && <div className="mt-4"><ErrorNotice error={themeQuery.error} /></div>}
        {theme && (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label>
                <span className="label">WARNA UTAMA</span>
                <div className="flex gap-3">
                  <input aria-label="Pilih warna utama" className="h-12 w-16 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1" type="color" disabled={!canEditTheme} value={previewColor} onChange={(event) => editTheme({ primaryColor: event.target.value.toUpperCase() })} />
                  <input aria-label="Kode warna utama" aria-invalid={!themeColorValid} className="field uppercase" maxLength={7} placeholder="#RRGGBB" disabled={!canEditTheme} value={theme.primaryColor} onChange={(event) => editTheme({ primaryColor: event.target.value })} />
                </div>
                {!themeColorValid && <span className="mt-1 block text-xs font-bold text-red-600">Gunakan format #RRGGBB, misalnya #C2410C.</span>}
              </label>
              <div className="rounded-2xl border border-[var(--border)] p-4">
                <p className="text-xs font-bold text-[var(--muted-foreground)]">PREVIEW</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="rounded-xl px-4 py-2 text-sm font-black" style={{ background: previewColor, color: previewForeground }}>Tombol utama</span>
                  <span className="text-sm font-black" style={{ color: previewColor }}>Tautan</span>
                </div>
                <p className={`mt-3 text-xs ${previewContrast < 4.5 ? "font-bold text-amber-700" : "text-[var(--muted-foreground)]"}`}>
                  Kontras teks tombol {previewContrast.toFixed(1)}:1{previewContrast < 4.5 ? " — kurang terbaca, pilih warna lebih gelap atau lebih terang." : ""}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {imageFields.map(([field, label, help]) => {
                const imageUrl = theme[field];
                return (
                  <div key={field} className="rounded-2xl border border-[var(--border)] p-4">
                    <span className="label">{label}</span>
                    <div className="mt-2 flex items-center gap-4">
                      <div
                        className="h-20 w-20 shrink-0 rounded-2xl border border-[var(--border)] bg-white bg-contain bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${JSON.stringify(imageUrl || "/dagoraapp-logo.png")})` }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="mb-2 text-xs text-[var(--muted-foreground)]">{help}, maksimal 2 MB.</p>
                        {canEditTheme && (
                          <>
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
                              {uploadImage.isPending && uploadImage.variables?.field === field
                                ? "Mengunggah..."
                                : imageUrl
                                  ? "Ganti gambar"
                                  : "Pilih gambar"}
                            </label>
                            {imageUrl && (
                              <button
                                type="button"
                                className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-red-600"
                                onClick={() => editTheme({ [field]: null })}
                              >
                                <Trash2 size={13} /> Hapus
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {uploadImage.error && <div className="mt-4"><ErrorNotice error={uploadImage.error} /></div>}
        {saveTheme.error && <div className="mt-4"><ErrorNotice error={saveTheme.error} /></div>}
      </section>
      <form onSubmit={submit} className="card mx-auto max-w-3xl space-y-5 p-6">
        <section>
          <h2 className="text-lg font-black">Identitas outlet dan struk</h2>
          <p className="mt-1 text-sm text-[#796c63]">
            Nama toko, kontak, pajak, dan teks struk untuk outlet aktif. Logo dan warna diatur di tema tenant.
          </p>
        </section>
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
          <SearchSelect
            label="UKURAN STRUK"
            value={form.receiptPaperSize}
            options={[
              { value: "MM58", label: "58 MM" },
              { value: "MM80", label: "80 MM" },
            ]}
            onChange={(value) =>
              setForm({
                ...form,
                receiptPaperSize: value as Settings["receiptPaperSize"],
              })
            }
          />
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
