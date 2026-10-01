"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Category } from "@/lib/types";
import {
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
export default function CategoriesPage() {
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ data: Category[] }>("/categories"),
  });
  const create = useMutation({
    mutationFn: () =>
      api("/categories", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      }),
    onSuccess: () => {
      setName("");
      setDescription("");
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
  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }
  if (query.isLoading) return <Loading />;
  return (
    <>
      <PageHeader
        title="Kategori"
        description="Atur urutan dan visibilitas kelompok menu."
      />
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="card h-fit space-y-4 p-5">
          <h2 className="font-black">Kategori baru</h2>
          <label>
            <span className="label">NAMA</span>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label>
            <span className="label">DESKRIPSI</span>
            <textarea
              className="field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </label>
          {create.error && <ErrorNotice error={create.error} />}
          <button className="btn-primary w-full" disabled={create.isPending}>
            Simpan kategori
          </button>
        </form>
        <section className="card overflow-hidden">
          <div className="divide-y divide-[#f1e8df]">
            {query.data?.data.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="font-black">{item.name}</p>
                  <p className="mt-1 text-sm text-[#796c63]">
                    {item.description || "Tanpa deskripsi"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                  <button
                    className="btn-ghost"
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
      </div>
    </>
  );
}
