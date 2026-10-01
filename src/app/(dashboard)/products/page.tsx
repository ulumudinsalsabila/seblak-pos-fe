"use client";

import { FormEvent, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import type { Category, Product } from "@/lib/types";
import {
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  StatusBadge,
} from "@/components/ui";

type ProductListResponse = {
  data: Product[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const initialForm = {
  categoryId: "",
  name: "",
  sku: "",
  pricingType: "FIXED",
  price: 15000,
  trackStock: false,
  stock: 0,
};

export default function ProductsPage() {
  const client = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    categoryId: "",
    status: "",
    page: 1,
    limit: 10,
  });
  const [form, setForm] = useState({ ...initialForm });

  const products = useQuery({
    queryKey: ["products", "admin", filters],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(filters.page),
        limit: String(filters.limit),
      });
      if (filters.search) params.set("search", filters.search);
      if (filters.categoryId) params.set("categoryId", filters.categoryId);
      if (filters.status) params.set("status", filters.status);
      return api<ProductListResponse>(`/products?${params}`);
    },
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ data: Category[] }>("/categories"),
  });

  const save = useMutation({
    mutationFn: () =>
      api(editingProduct ? `/products/${editingProduct.id}` : "/products", {
        method: editingProduct ? "PATCH" : "POST",
        body: JSON.stringify({
          ...form,
          stock: form.trackStock ? form.stock : undefined,
        }),
      }),
    onSuccess: () => {
      setForm({ ...initialForm });
      setEditingProduct(null);
      setDialogOpen(false);
      setFilters((value) => ({ ...value, page: 1 }));
      void client.invalidateQueries({ queryKey: ["products"] });
    },
  });
  const toggle = useMutation({
    mutationFn: (item: Product) =>
      api(`/products/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !item.isActive }),
      }),
    onSuccess: () => {
      setFilters((value) => ({ ...value, page: 1 }));
      void client.invalidateQueries({ queryKey: ["products"] });
    },
  });

  function submitProduct(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setFilters((value) => ({
      ...value,
      search: searchInput.trim(),
      page: 1,
    }));
  }

  function closeDialog() {
    if (save.isPending) return;
    setDialogOpen(false);
    setEditingProduct(null);
    save.reset();
  }

  function openCreateDialog() {
    save.reset();
    setEditingProduct(null);
    setForm({ ...initialForm });
    setDialogOpen(true);
  }

  function openEditDialog(item: Product) {
    save.reset();
    setEditingProduct(item);
    setForm({
      categoryId: item.categoryId,
      name: item.name,
      sku: item.sku,
      pricingType: item.pricingType,
      price: item.price,
      trackStock: item.trackStock,
      stock: item.stock ?? 0,
    });
    setDialogOpen(true);
  }

  if (products.isLoading || categories.isLoading) return <Loading />;
  if (categories.error) return <ErrorNotice error={categories.error} />;

  const items = products.data?.data ?? [];
  const meta = products.data?.meta;

  return (
    <>
      <PageHeader
        title="Produk"
        description="Harga dan stok resmi yang dipakai backend saat checkout."
        action={
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={openCreateDialog}
          >
            <Plus size={18} />
            Tambah produk
          </button>
        }
      />

      <section className="card mb-5 p-4">
        <form
          onSubmit={submitSearch}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_240px_180px_auto]"
        >
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#796c63]"
            />
            <input
              className="field field-with-icon"
              placeholder="Cari nama atau SKU..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <select
            className="field"
            value={filters.categoryId}
            onChange={(event) =>
              setFilters((value) => ({
                ...value,
                categoryId: event.target.value,
                page: 1,
              }))
            }
          >
            <option value="">Semua kategori</option>
            {categories.data?.data.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={filters.status}
            onChange={(event) =>
              setFilters((value) => ({
                ...value,
                status: event.target.value,
                page: 1,
              }))
            }
          >
            <option value="">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
          <button className="btn-primary" type="submit">
            Cari
          </button>
        </form>
      </section>

      {products.error && <ErrorNotice error={products.error} />}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[#eadfd3] px-4 py-3 text-sm text-[#796c63]">
          <span>
            {meta ? `${meta.total} produk ditemukan` : "Daftar produk"}
          </span>
          {products.isFetching && (
            <span className="font-semibold text-[#e7562c]">Memuat...</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#fff8f1] text-xs text-[#796c63]">
              <tr>
                <th className="p-4">PRODUK</th>
                <th className="p-4">KATEGORI</th>
                <th className="p-4">HARGA</th>
                <th className="p-4">STOK</th>
                <th className="p-4">STATUS</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-[#f1e8df] hover:bg-orange-50/40"
                >
                  <td className="p-4">
                    <b>{item.name}</b>
                    <p className="text-xs text-[#796c63]">{item.sku}</p>
                  </td>
                  <td className="p-4">{item.category.name}</td>
                  <td className="p-4 font-black">{rupiah(item.price)}</td>
                  <td className="p-4">{item.trackStock ? item.stock : "—"}</td>
                  <td className="p-4">
                    <StatusBadge
                      status={item.isActive ? "ACTIVE" : "INACTIVE"}
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn-ghost flex items-center gap-1.5"
                        onClick={() => openEditDialog(item)}
                      >
                        <Pencil size={15} />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={
                          toggle.isPending && toggle.variables?.id === item.id
                        }
                        onClick={() => toggle.mutate(item)}
                      >
                        {item.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && !products.error && (
          <Empty>Tidak ada produk sesuai filter.</Empty>
        )}
        {meta && meta.totalPages > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfd3] bg-[#fffdfa] px-4 py-3">
            <p className="text-sm text-[#796c63]">
              Halaman <b className="text-[#241c17]">{meta.page}</b> dari{" "}
              <b className="text-[#241c17]">{meta.totalPages}</b>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost flex items-center gap-1"
                disabled={filters.page <= 1 || products.isFetching}
                onClick={() =>
                  setFilters((value) => ({
                    ...value,
                    page: Math.max(1, value.page - 1),
                  }))
                }
              >
                <ChevronLeft size={17} />
                Sebelumnya
              </button>
              <button
                type="button"
                className="btn-ghost flex items-center gap-1"
                disabled={
                  filters.page >= meta.totalPages || products.isFetching
                }
                onClick={() =>
                  setFilters((value) => ({
                    ...value,
                    page: Math.min(meta.totalPages, value.page + 1),
                  }))
                }
              >
                Berikutnya
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        )}
      </section>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            type="button"
            aria-label="Tutup dialog produk"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={closeDialog}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-dialog-title"
            className="card relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto p-5 sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="product-dialog-title" className="text-xl font-black">
                  {editingProduct ? "Edit produk" : "Produk baru"}
                </h2>
                <p className="mt-1 text-sm text-[#796c63]">
                  {editingProduct
                    ? "Perbarui informasi produk yang dipilih."
                    : "Tambahkan produk ke katalog Saung Sunja."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup"
                className="rounded-xl border border-[#eadfd3] p-2 text-[#796c63]"
                onClick={closeDialog}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitProduct} className="space-y-4">
              <label>
                <span className="label">KATEGORI</span>
                <select
                  autoFocus
                  className="field"
                  required
                  value={form.categoryId}
                  onChange={(event) =>
                    setForm({ ...form, categoryId: event.target.value })
                  }
                >
                  <option value="">Pilih kategori</option>
                  {categories.data?.data
                    .filter(
                      (category) =>
                        category.isActive || category.id === form.categoryId,
                    )
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="label">NAMA</span>
                  <input
                    className="field"
                    required
                    maxLength={100}
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span className="label">SKU</span>
                  <input
                    className="field uppercase"
                    required
                    maxLength={50}
                    value={form.sku}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        sku: event.target.value.toUpperCase(),
                      })
                    }
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="label">TIPE HARGA</span>
                  <select
                    className="field"
                    value={form.pricingType}
                    onChange={(event) =>
                      setForm({ ...form, pricingType: event.target.value })
                    }
                  >
                    <option value="FIXED">Harga tetap</option>
                    <option value="PER_ITEM">Per item</option>
                  </select>
                </label>
                <label>
                  <span className="label">HARGA</span>
                  <input
                    className="field"
                    type="number"
                    required
                    min={0}
                    value={form.price}
                    onChange={(event) =>
                      setForm({ ...form, price: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-[#eadfd3] bg-[#fff8f1] p-4 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={form.trackStock}
                  onChange={(event) =>
                    setForm({ ...form, trackStock: event.target.checked })
                  }
                />
                Pantau stok produk
              </label>
              {form.trackStock && (
                <label>
                  <span className="label">STOK AWAL</span>
                  <input
                    className="field"
                    type="number"
                    required
                    min={0}
                    value={form.stock}
                    onChange={(event) =>
                      setForm({ ...form, stock: Number(event.target.value) })
                    }
                  />
                </label>
              )}
              {save.error && <ErrorNotice error={save.error} />}
              <div className="grid grid-cols-2 gap-3 border-t border-[#eadfd3] pt-4">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={save.isPending}
                  onClick={closeDialog}
                >
                  Batal
                </button>
                <button className="btn-primary" disabled={save.isPending}>
                  {save.isPending
                    ? "Menyimpan..."
                    : editingProduct
                      ? "Simpan perubahan"
                      : "Simpan produk"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
