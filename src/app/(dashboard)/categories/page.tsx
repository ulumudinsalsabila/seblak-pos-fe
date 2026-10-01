"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";
import {
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  StatusBadge,
} from "@/components/ui";

type CategoryForm = {
  name: string;
  description: string;
  sortOrder: number;
};

const emptyForm: CategoryForm = {
  name: "",
  description: "",
  sortOrder: 0,
};

export default function CategoriesPage() {
  const client = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);

  const query = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ data: Category[] }>("/categories"),
  });

  const save = useMutation({
    mutationFn: () =>
      api(editingCategory ? `/categories/${editingCategory.id}` : "/categories", {
        method: editingCategory ? "PATCH" : "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          sortOrder: form.sortOrder,
        }),
      }),
    onSuccess: () => {
      closeDialog();
      void client.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const toggle = useMutation({
    mutationFn: (item: Category) =>
      api(`/categories/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !item.isActive }),
      }),
    onSuccess: () =>
      void client.invalidateQueries({ queryKey: ["categories"] }),
  });

  function openCreateDialog() {
    const categories = query.data?.data ?? [];
    const nextSortOrder = categories.length
      ? Math.max(...categories.map((item) => item.sortOrder)) + 1
      : 0;
    setEditingCategory(null);
    setForm({ ...emptyForm, sortOrder: nextSortOrder });
    save.reset();
    setDialogOpen(true);
  }

  function openEditDialog(item: Category) {
    setEditingCategory(item);
    setForm({
      name: item.name,
      description: item.description ?? "",
      sortOrder: item.sortOrder,
    });
    save.reset();
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingCategory(null);
    setForm(emptyForm);
    save.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} />;

  return (
    <>
      <PageHeader
        title="Kategori"
        description="Atur urutan dan visibilitas kelompok menu."
        action={
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={openCreateDialog}
          >
            <Plus size={18} />
            Tambah kategori
          </button>
        }
      />

      <section className="card overflow-hidden">
        <div className="divide-y divide-[#f1e8df]">
          {query.data?.data.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black">{item.name}</p>
                  <span className="text-xs font-bold text-[#9b8a7d]">
                    Urutan {item.sortOrder}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#796c63]">
                  {item.description || "Tanpa deskripsi"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                <button
                  type="button"
                  className="btn-ghost flex items-center gap-2"
                  onClick={() => openEditDialog(item)}
                >
                  <Pencil size={16} />
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate(item)}
                >
                  {item.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            </div>
          ))}
        </div>
        {!query.data?.data.length && <Empty>Belum ada kategori.</Empty>}
      </section>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            type="button"
            aria-label="Tutup dialog kategori"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={closeDialog}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-dialog-title"
            className="card relative z-10 w-full max-w-lg p-5 sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="category-dialog-title" className="text-xl font-black">
                  {editingCategory ? "Edit kategori" : "Kategori baru"}
                </h2>
                <p className="mt-1 text-sm text-[#796c63]">
                  {editingCategory
                    ? "Perbarui informasi kategori yang dipilih."
                    : "Tambahkan kelompok menu baru."}
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

            <form onSubmit={submit} className="space-y-4">
              <label>
                <span className="label">NAMA</span>
                <input
                  autoFocus
                  className="field"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  required
                  maxLength={100}
                />
              </label>
              <label>
                <span className="label">DESKRIPSI</span>
                <textarea
                  className="field"
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  maxLength={500}
                />
              </label>
              <label>
                <span className="label">URUTAN</span>
                <input
                  className="field"
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm({ ...form, sortOrder: Number(event.target.value) })
                  }
                  required
                />
              </label>

              {save.error && <ErrorNotice error={save.error} />}

              <div className="grid grid-cols-2 gap-3 border-t border-[#eadfd3] pt-4">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={closeDialog}
                >
                  Batal
                </button>
                <button className="btn-primary" disabled={save.isPending}>
                  {save.isPending
                    ? "Menyimpan..."
                    : editingCategory
                      ? "Simpan perubahan"
                      : "Simpan kategori"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
