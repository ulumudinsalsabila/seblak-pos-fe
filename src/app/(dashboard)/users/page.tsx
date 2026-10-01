"use client";
import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import {
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
export default function UsersPage() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ data: User[] }>("/users"),
  });
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "CASHIER",
  });
  const create = useMutation({
    mutationFn: () =>
      api("/users", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      setForm({ name: "", email: "", password: "", role: "CASHIER" });
      void client.invalidateQueries({ queryKey: ["users"] });
    },
  });
  const toggle = useMutation({
    mutationFn: (user: User) =>
      api(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["users"] }),
  });
  function submit(e: FormEvent) {
    e.preventDefault();
    create.mutate();
  }
  if (query.isLoading) return <Loading />;
  return (
    <>
      <PageHeader
        title="Pengguna"
        description="Kelola akun Owner dan Cashier."
      />
      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <form onSubmit={submit} className="card h-fit space-y-4 p-5">
          <h2 className="font-black">Pengguna baru</h2>
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
            <span className="label">EMAIL</span>
            <input
              className="field"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            <span className="label">PASSWORD</span>
            <input
              className="field"
              type="password"
              minLength={8}
              maxLength={72}
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <label>
            <span className="label">ROLE</span>
            <select
              className="field"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="CASHIER">CASHIER</option>
              <option value="OWNER">OWNER</option>
            </select>
          </label>
          {create.error && <ErrorNotice error={create.error} />}
          <button className="btn-primary w-full">Buat pengguna</button>
        </form>
        <section className="card overflow-hidden">
          <div className="divide-y divide-[#f1e8df]">
            {query.data?.data.map((user) => (
              <div key={user.id} className="flex items-center gap-4 p-4">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-[#fff0e8] font-black text-[#e7562c]">
                  {(user.name ?? user.email)[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black">{user.name}</p>
                  <p className="truncate text-sm text-[#796c63]">
                    {user.email} · {user.role}
                  </p>
                </div>
                <StatusBadge status={user.status ?? "ACTIVE"} />
                <button
                  className="btn-ghost"
                  onClick={() => toggle.mutate(user)}
                >
                  {user.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            ))}
          </div>
          {!query.data?.data.length && <Empty>Belum ada pengguna.</Empty>}
        </section>
      </div>
    </>
  );
}
