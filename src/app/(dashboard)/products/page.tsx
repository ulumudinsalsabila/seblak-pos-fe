"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
export default function ProductsPage() {
  const client = useQueryClient();
  const products = useQuery({
    queryKey: ["products"],
    queryFn: () => api<{ data: Product[] }>("/products"),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ data: Category[] }>("/categories"),
  });
  const [form, setForm] = useState({
    categoryId: "",
    name: "",
    sku: "",
    pricingType: "FIXED",
    price: 15000,
    trackStock: false,
    stock: 0,
  });
  const create = useMutation({
    mutationFn: () =>
      api("/products", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          stock: form.trackStock ? form.stock : undefined,
        }),
      }),
    onSuccess: () => {
      setForm((v) => ({ ...v, name: "", sku: "" }));
      void client.invalidateQueries({ queryKey: ["products"] });
    },
  });
  const toggle = useMutation({
    mutationFn: (item: Product) =>
      api(`/products/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !item.isActive }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["products"] }),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }
  if (products.isLoading || categories.isLoading) return <Loading />;
  return (
    <>
      <PageHeader
        title="Produk"
        description="Harga dan stok resmi yang dipakai backend saat checkout."
      />
      <div className="grid gap-6 2xl:grid-cols-[410px_1fr]">
        <form onSubmit={submit} className="card h-fit space-y-4 p-5">
          <h2 className="font-black">Produk baru</h2>
          <label>
            <span className="label">KATEGORI</span>
            <select
              className="field"
              required
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            >
              <option value="">Pilih kategori</option>
              {categories.data?.data
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">NAMA</span>
              <input
                className="field"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              <span className="label">SKU</span>
              <input
                className="field"
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">TIPE</span>
              <select
                className="field"
                value={form.pricingType}
                onChange={(e) =>
                  setForm({ ...form, pricingType: e.target.value })
                }
              >
                <option>FIXED</option>
                <option>PER_ITEM</option>
              </select>
            </label>
            <label>
              <span className="label">HARGA</span>
              <input
                className="field"
                type="number"
                min={0}
                value={form.price}
                onChange={(e) =>
                  setForm({ ...form, price: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={form.trackStock}
              onChange={(e) =>
                setForm({ ...form, trackStock: e.target.checked })
              }
            />
            Track stock
          </label>
          {form.trackStock && (
            <label>
              <span className="label">STOK AWAL</span>
              <input
                className="field"
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) =>
                  setForm({ ...form, stock: Number(e.target.value) })
                }
              />
            </label>
          )}
          {create.error && <ErrorNotice error={create.error} />}
          <button className="btn-primary w-full" disabled={create.isPending}>
            Simpan produk
          </button>
        </form>
        <section className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
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
              {products.data?.data.map((item) => (
                <tr key={item.id} className="border-t border-[#f1e8df]">
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
                  <td className="p-4 text-right">
                    <button
                      className="btn-ghost"
                      onClick={() => toggle.mutate(item)}
                    >
                      {item.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!products.data?.data.length && <Empty>Belum ada produk.</Empty>}
        </section>
      </div>
    </>
  );
}
