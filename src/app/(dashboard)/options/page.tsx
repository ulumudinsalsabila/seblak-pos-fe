"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Category, MenuOptionGroup, Settings } from "@/lib/types";
import { ErrorNotice, Loading, PageHeader } from "@/components/ui";

const newId = () => crypto.randomUUID();

export default function OptionsPage() {
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ data: Settings }>("/settings"),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<{ data: Category[] }>("/categories"),
  });
  const [draft, setDraft] = useState<MenuOptionGroup[] | null>(null);
  const groups = draft ?? settings.data?.data.menuOptions ?? [];
  const save = useMutation({
    mutationFn: () => api("/settings", {
      method: "PATCH",
      body: JSON.stringify({ menuOptions: groups }),
    }),
    onSuccess: () => {
      setDraft(null);
      void client.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  if (settings.isLoading || categories.isLoading) return <Loading />;
  const categoryRows = categories.data?.data ?? [];
  const updateGroup = (index: number, change: Partial<MenuOptionGroup>) =>
    setDraft(groups.map((group, position) => position === index ? { ...group, ...change } : group));

  return <>
    <PageHeader title="Opsi menu" description="Atur pilihan menu dan petakan ke kategori yang sesuai." />
    <div className="mx-auto max-w-4xl space-y-4">
      {groups.map((group, groupIndex) => (
        <section className="card p-5" key={group.id}>
          <div className="flex flex-wrap items-start gap-3">
            <label className="min-w-52 flex-1"><span className="label">NAMA OPSI</span><input className="field" maxLength={100} value={group.name} onChange={(e) => updateGroup(groupIndex, { name: e.target.value })} /></label>
            <label className="w-28"><span className="label">URUTAN</span><input className="field" type="number" min={0} max={9999} value={group.sortOrder} onChange={(e) => updateGroup(groupIndex, { sortOrder: Number(e.target.value) })} /></label>
            <label className="mt-7 flex items-center gap-2 font-bold"><input type="checkbox" checked={group.isActive} onChange={(e) => updateGroup(groupIndex, { isActive: e.target.checked })} /> Aktif</label>
            <button type="button" aria-label={`Hapus ${group.name}`} className="mt-6 rounded-xl border border-red-200 p-3 text-red-600" onClick={() => setDraft(groups.filter((_, index) => index !== groupIndex))}><Trash2 size={18} /></button>
          </div>

          <div className="mt-4">
            <span className="label">BERLAKU UNTUK KATEGORI</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {categoryRows.map((category) => {
                const checked = group.categoryIds.includes(category.id);
                return <label key={category.id} className={`cursor-pointer rounded-full border px-3 py-2 text-sm font-bold ${checked ? "border-[#e7562c] bg-[#fff0e8] text-[#d94722]" : "border-[#eadfd3] bg-white"}`}>
                  <input className="mr-2" type="checkbox" checked={checked} onChange={() => updateGroup(groupIndex, { categoryIds: checked ? group.categoryIds.filter((id) => id !== category.id) : [...group.categoryIds, category.id] })} />{category.name}
                </label>;
              })}
            </div>
            {!group.categoryIds.length && <p className="mt-2 text-xs font-bold text-red-600">Pilih minimal satu kategori.</p>}
          </div>

          <div className="mt-5 space-y-2">
            <span className="label">PILIHAN NILAI</span>
            {group.values.map((value, valueIndex) => (
              <div className="flex items-center gap-2" key={value.id}>
                <input className="field" maxLength={100} value={value.label} placeholder="Contoh: Pedas" onChange={(e) => updateGroup(groupIndex, { values: group.values.map((item, index) => index === valueIndex ? { ...item, label: e.target.value } : item) })} />
                <label className="flex shrink-0 items-center gap-1 text-sm font-bold"><input type="radio" name={`default-${group.id}`} checked={Boolean(value.isDefault)} onChange={() => updateGroup(groupIndex, { values: group.values.map((item, index) => ({ ...item, isDefault: index === valueIndex })) })} /> Default</label>
                <button type="button" aria-label={`Hapus ${value.label}`} className="rounded-xl border border-[#eadfd3] p-3 text-red-600" onClick={() => updateGroup(groupIndex, { values: group.values.filter((_, index) => index !== valueIndex) })}><Trash2 size={17} /></button>
              </div>
            ))}
            <button type="button" className="btn-ghost mt-2 inline-flex items-center gap-2" onClick={() => updateGroup(groupIndex, { values: [...group.values, { id: newId(), label: "", isDefault: group.values.length === 0 }] })}><Plus size={17} /> Tambah nilai</button>
          </div>
        </section>
      ))}
      <button type="button" className="btn-ghost inline-flex items-center gap-2" onClick={() => setDraft([...groups, { id: newId(), name: "Opsi baru", sortOrder: groups.length + 1, isActive: true, categoryIds: [], values: [] }])}><Plus size={18} /> Tambah grup opsi</button>
      {save.error && <ErrorNotice error={save.error} />}
      <div><button type="button" className="btn-primary" disabled={save.isPending || groups.some((group) => !group.name.trim() || !group.categoryIds.length || !group.values.length || group.values.some((value) => !value.label.trim()))} onClick={() => save.mutate()}>{save.isPending ? "Menyimpan..." : "Simpan opsi"}</button></div>
    </div>
  </>;
}
