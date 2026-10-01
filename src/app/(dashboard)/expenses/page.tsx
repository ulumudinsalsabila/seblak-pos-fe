"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { localDate, rupiah } from "@/lib/format";
import type { Expense } from "@/lib/types";
import { Empty, ErrorNotice, Loading, PageHeader } from "@/components/ui";
export default function ExpensesPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api<{ data: Expense[] }>("/expenses"),
  });
  const [form, setForm] = useState({
    description: "",
    amount: 0,
    expenseDate: localDate(),
    notes: "",
  });
  const create = useMutation({
    mutationFn: () =>
      api("/expenses", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm((v) => ({ ...v, description: "", amount: 0, notes: "" }));
      void client.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/expenses/${id}`, { method: "DELETE" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["expenses"] }),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }
  if (query.isLoading) return <Loading />;
  return (
    <>
      <PageHeader
        title="Pengeluaran"
        description="Catat arus keluar operasional outlet."
      />
      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <form onSubmit={submit} className="card h-fit space-y-4 p-5">
          <h2 className="font-black">Catat pengeluaran</h2>
          <label>
            <span className="label">DESKRIPSI</span>
            <input
              className="field"
              required
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">NOMINAL</span>
              <input
                className="field"
                type="number"
                min={1}
                required
                value={form.amount || ""}
                onChange={(e) =>
                  setForm({ ...form, amount: Number(e.target.value) })
                }
              />
            </label>
            <label>
              <span className="label">TANGGAL</span>
              <input
                className="field"
                type="date"
                required
                value={form.expenseDate}
                onChange={(e) =>
                  setForm({ ...form, expenseDate: e.target.value })
                }
              />
            </label>
          </div>
          <label>
            <span className="label">CATATAN</span>
            <textarea
              className="field"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </label>
          {create.error && <ErrorNotice error={create.error} />}
          <button className="btn-primary w-full">Simpan pengeluaran</button>
        </form>
        <section className="card overflow-hidden">
          <div className="divide-y divide-[#f1e8df]">
            {query.data?.data.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-black">{item.description}</p>
                  <p className="mt-1 text-xs text-[#796c63]">
                    {item.expenseDate.slice(0, 10)} · {item.createdBy?.name}
                  </p>
                </div>
                <b className="text-red-600">-{rupiah(item.amount)}</b>
                <button
                  aria-label="Hapus"
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                  onClick={() => remove.mutate(item.id)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          {!query.data?.data.length && <Empty>Belum ada pengeluaran.</Empty>}
        </section>
      </div>
    </>
  );
}
