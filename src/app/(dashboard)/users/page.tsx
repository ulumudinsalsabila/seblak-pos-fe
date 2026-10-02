"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Role, User } from "@/lib/types";
import {
  Empty,
  ErrorNotice,
  Loading,
  PageHeader,
  StatusBadge,
} from "@/components/ui";

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: Role;
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  password: "",
  role: "CASHIER",
};

export default function UsersPage() {
  const client = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const query = useQuery({
    queryKey: ["users"],
    queryFn: () => api<{ data: User[] }>("/users"),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        ...(!editingUser || form.password ? { password: form.password } : {}),
      };

      return api(editingUser ? `/users/${editingUser.id}` : "/users", {
        method: editingUser ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      closeDialog();
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

  function openCreateDialog() {
    setEditingUser(null);
    setForm(emptyForm);
    save.reset();
    setDialogOpen(true);
  }

  function openEditDialog(user: User) {
    setEditingUser(user);
    setForm({
      name: user.name ?? "",
      email: user.email,
      password: "",
      role: user.role,
    });
    save.reset();
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingUser(null);
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
        title="Pengguna"
        description="Kelola tim dan akses mereka di outlet aktif."
        action={
          <button
            type="button"
            className="btn-primary flex items-center gap-2"
            onClick={openCreateDialog}
          >
            <Plus size={18} />
            Tambah pengguna
          </button>
        }
      />

      <section className="card overflow-hidden">
        <div className="divide-y divide-[#f1e8df]">
          {query.data?.data.map((user) => (
            <div
              key={user.id}
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff0e8] font-black text-[#e7562c]">
                {(user.name ?? user.email)[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black">{user.name}</p>
                <p className="truncate text-sm text-[#796c63]">
                  {user.email} · {user.role}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={user.status ?? "ACTIVE"} />
                <button
                  type="button"
                  className="btn-ghost flex items-center gap-2"
                  onClick={() => openEditDialog(user)}
                >
                  <Pencil size={16} />
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate(user)}
                >
                  {user.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            </div>
          ))}
        </div>
        {!query.data?.data.length && <Empty>Belum ada pengguna.</Empty>}
      </section>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <button
            type="button"
            aria-label="Tutup dialog pengguna"
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={closeDialog}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-dialog-title"
            className="card relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto p-5 sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="user-dialog-title" className="text-xl font-black">
                  {editingUser ? "Edit pengguna" : "Pengguna baru"}
                </h2>
                <p className="mt-1 text-sm text-[#796c63]">
                  {editingUser
                    ? "Perbarui informasi akun yang dipilih."
                    : "Tambahkan akun untuk outlet aktif."}
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
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </label>
              <label>
                <span className="label">EMAIL</span>
                <input
                  className="field"
                  type="email"
                  required
                  maxLength={254}
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
              </label>
              <label>
                <span className="label">
                  PASSWORD {editingUser && "(OPSIONAL)"}
                </span>
                <input
                  className="field"
                  type="password"
                  minLength={8}
                  maxLength={72}
                  required={!editingUser}
                  value={form.password}
                  onChange={(event) =>
                    setForm({ ...form, password: event.target.value })
                  }
                  placeholder={
                    editingUser ? "Kosongkan jika tidak ingin diubah" : undefined
                  }
                />
              </label>
              <label>
                <span className="label">ROLE</span>
                <select
                  className="field"
                  value={form.role}
                  onChange={(event) =>
                    setForm({ ...form, role: event.target.value as Role })
                  }
                >
                  <option value="CASHIER">CASHIER</option>
                  <option value="KITCHEN">KITCHEN</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="OWNER">OWNER</option>
                </select>
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
                    : editingUser
                      ? "Simpan perubahan"
                      : "Buat pengguna"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
