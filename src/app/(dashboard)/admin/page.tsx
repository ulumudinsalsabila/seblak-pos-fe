"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus, ReceiptText, Settings2, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { Empty, ErrorNotice, Loading, PageHeader, StatusBadge } from "@/components/ui";
import { rupiah } from "@/lib/format";
import { useAuth } from "@/components/auth-provider";
import { FormInput, SearchSelect } from "@/components/form-controls";

type FeeType = "NONE" | "FIXED" | "PERCENTAGE" | "HYBRID";
type Outlet = {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "SUSPENDED";
  tenant: { name: string; slug: string };
  settings?: { storeName: string; logoUrl?: string };
  feeConfigs: Array<{
    type: FeeType;
    fixedAmount: number;
    percentage: string;
  }>;
  _count: { memberships: number; transactions: number };
};
type Ledger = {
  id: string;
  amount: number;
  type: "CHARGE" | "REVERSAL" | "ADJUSTMENT";
  status: string;
  createdAt: string;
  outlet: { name: string; code: string };
  transaction?: { invoiceNo: string; total: number };
};
type Tenant = { id: string; name: string; slug: string; _count: { outlets: number } };

const initialCreate = {
  tenantId: "",
  tenantName: "",
  tenantSlug: "",
  outletName: "",
  outletCode: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  feeType: "NONE" as FeeType,
  fixedAmount: "0",
  percentage: "0",
};

export default function AdminPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [feeOutlet, setFeeOutlet] = useState<Outlet | null>(null);
  const [editOutlet, setEditOutlet] = useState<Outlet | null>(null);
  const [outletDraft, setOutletDraft] = useState({ name: "", code: "" });
  const [ledgerPage, setLedgerPage] = useState(1);
  const [form, setForm] = useState(initialCreate);
  const [fee, setFee] = useState({ type: "NONE" as FeeType, fixedAmount: "0", percentage: "0" });

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") window.location.replace("/dashboard");
  }, [user]);

  const outlets = useQuery({
    queryKey: ["admin-outlets"],
    queryFn: () => api<{ data: Outlet[] }>("/admin/outlets"),
    enabled: user?.role === "SUPER_ADMIN",
  });
  const ledger = useQuery({
    queryKey: ["admin-fee-ledger", ledgerPage],
    queryFn: () =>
      api<{ data: Ledger[]; meta: { page: number; total: number; totalPages: number; netAmount: number } }>(
        `/admin/fee-ledger?page=${ledgerPage}&limit=20`,
      ),
    enabled: user?.role === "SUPER_ADMIN",
  });
  const tenants = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: () => api<{ data: Tenant[] }>("/admin/tenants"),
    enabled: user?.role === "SUPER_ADMIN",
  });

  const createOutlet = useMutation({
    mutationFn: () =>
      api("/admin/outlets", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          tenantId: form.tenantId || undefined,
          tenantSlug: form.tenantSlug.toLowerCase(),
          outletCode: form.outletCode.toUpperCase(),
          fixedAmount: Number(form.fixedAmount),
          percentage: Number(form.percentage),
        }),
      }),
    onSuccess: () => {
      setCreateOpen(false);
      setForm(initialCreate);
      void client.invalidateQueries({ queryKey: ["admin-outlets"] });
      void client.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
  });

  const updateFee = useMutation({
    mutationFn: () =>
      api(`/admin/outlets/${feeOutlet?.id}/fee`, {
        method: "PATCH",
        body: JSON.stringify({
          type: fee.type,
          fixedAmount: Number(fee.fixedAmount),
          percentage: Number(fee.percentage),
        }),
      }),
    onSuccess: () => {
      setFeeOutlet(null);
      void client.invalidateQueries({ queryKey: ["admin-outlets"] });
    },
  });

  const toggleStatus = useMutation({
    mutationFn: (outlet: Outlet) =>
      api(`/admin/outlets/${outlet.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: outlet.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
        }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["admin-outlets"] }),
  });
  const saveOutlet = useMutation({
    mutationFn: () =>
      api(`/admin/outlets/${editOutlet?.id}`, {
        method: "PATCH",
        body: JSON.stringify(outletDraft),
      }),
    onSuccess: () => {
      setEditOutlet(null);
      void client.invalidateQueries({ queryKey: ["admin-outlets"] });
    },
  });
  const removeOutlet = useMutation({
    mutationFn: (outlet: Outlet) =>
      api(`/admin/outlets/${outlet.id}`, { method: "DELETE" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["admin-outlets"] }),
  });

  function openFee(outlet: Outlet) {
    const current = outlet.feeConfigs[0];
    setFee({
      type: current?.type ?? "NONE",
      fixedAmount: String(current?.fixedAmount ?? 0),
      percentage: String(current?.percentage ?? 0),
    });
    updateFee.reset();
    setFeeOutlet(outlet);
  }

  if (user?.role !== "SUPER_ADMIN") return <Loading label="Memeriksa akses..." />;
  if (outlets.isLoading) return <Loading label="Memuat outlet..." />;

  return (
    <>
      <PageHeader
        title="Super Admin"
        description="Kelola tenant, outlet, dan fee platform dari satu tempat."
        action={
          <button className="btn-primary flex items-center gap-2" onClick={() => setCreateOpen(true)}>
            <Plus size={18} /> Outlet baru
          </button>
        }
      />
      {outlets.error && <ErrorNotice error={outlets.error} />}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {outlets.data?.data.map((outlet) => {
          const currentFee = outlet.feeConfigs[0];
          return (
            <article key={outlet.id} className="card p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fff0e8] text-[#e7562c]">
                  <Building2 size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-black">{outlet.name}</p>
                  <p className="text-sm text-[#796c63]">{outlet.tenant.name} · {outlet.code}</p>
                </div>
                <StatusBadge status={outlet.status} />
              </div>
              <div className="my-4 grid grid-cols-2 gap-2 rounded-xl bg-[#fff7ef] p-3 text-sm">
                <div><p className="text-[#796c63]">Pengguna</p><p className="font-black">{outlet._count.memberships}</p></div>
                <div><p className="text-[#796c63]">Transaksi</p><p className="font-black">{outlet._count.transactions}</p></div>
              </div>
              <div className="mb-4 text-sm">
                <p className="text-[#796c63]">Fee aktif</p>
                <p className="font-black">
                  {currentFee?.type ?? "NONE"} · {rupiah(currentFee?.fixedAmount ?? 0)} · {Number(currentFee?.percentage ?? 0)}%
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" title="Edit outlet" onClick={() => { setOutletDraft({ name: outlet.name, code: outlet.code }); setEditOutlet(outlet); }}>
                  <Pencil size={16} />
                </button>
                <button className="btn-ghost flex flex-1 items-center justify-center gap-2" onClick={() => openFee(outlet)}>
                  <Settings2 size={16} /> Atur fee
                </button>
                <button className="btn-ghost" disabled={toggleStatus.isPending} onClick={() => toggleStatus.mutate(outlet)}>
                  {outlet.status === "ACTIVE" ? "Suspend" : "Aktifkan"}
                </button>
                <button className="btn-ghost text-red-600" title="Hapus/nonaktifkan outlet" disabled={removeOutlet.isPending} onClick={() => { if (window.confirm(`Nonaktifkan outlet ${outlet.name}?`)) removeOutlet.mutate(outlet); }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </section>
      {!outlets.data?.data.length && <Empty>Belum ada outlet.</Empty>}

      <section className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eadfd3] p-5">
          <div><h2 className="flex items-center gap-2 text-xl font-black"><ReceiptText size={20} /> Ledger fee</h2><p className="mt-1 text-sm text-[#796c63]">20 aktivitas terbaru</p></div>
          <div className="text-right"><p className="text-xs font-bold text-[#796c63]">NET FEE</p><p className="text-xl font-black text-[var(--brand)]">{rupiah(ledger.data?.meta.netAmount ?? 0)}</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#fff7ef] text-xs text-[#796c63]"><tr><th className="p-4">Tanggal</th><th>Outlet</th><th>Invoice</th><th>Tipe</th><th>Status</th><th className="pr-4 text-right">Nominal</th></tr></thead>
            <tbody className="divide-y divide-[#f1e8df]">
              {ledger.data?.data.map((row) => <tr key={row.id}><td className="p-4">{new Date(row.createdAt).toLocaleString("id-ID")}</td><td>{row.outlet.name}</td><td>{row.transaction?.invoiceNo ?? "-"}</td><td>{row.type}</td><td>{row.status}</td><td className="pr-4 text-right font-black">{rupiah(row.amount)}</td></tr>)}
            </tbody>
          </table>
        </div>
        {!ledger.data?.data.length && <Empty>Ledger masih kosong.</Empty>}
        {(ledger.data?.meta.totalPages ?? 0) > 1 && (
          <div className="flex items-center justify-between border-t border-[#eadfd3] p-4">
            <p className="text-sm text-[#796c63]">Halaman {ledger.data?.meta.page} dari {ledger.data?.meta.totalPages}</p>
            <div className="flex gap-2">
              <button className="btn-ghost" disabled={ledgerPage <= 1} onClick={() => setLedgerPage((page) => page - 1)}>Sebelumnya</button>
              <button className="btn-ghost" disabled={ledgerPage >= (ledger.data?.meta.totalPages ?? 1)} onClick={() => setLedgerPage((page) => page + 1)}>Berikutnya</button>
            </div>
          </div>
        )}
      </section>

      {createOpen && (
        <Modal title="Outlet baru" close={() => setCreateOpen(false)}>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); createOutlet.mutate(); }}>
            <div className="sm:col-span-2">
              <SearchSelect label="MERCHANT / TENANT" value={form.tenantId} clearable placeholder="Buat merchant baru" options={(tenants.data?.data ?? []).map((tenant) => ({ value: tenant.id, label: tenant.name, description: `${tenant._count.outlets} outlet · ${tenant.slug}` }))} onChange={(tenantId) => setForm({ ...form, tenantId })} />
            </div>
            {!form.tenantId && <>
              <Field label="NAMA TENANT" value={form.tenantName} set={(value) => setForm({ ...form, tenantName: value })} />
              <Field label="SLUG TENANT" value={form.tenantSlug} set={(value) => setForm({ ...form, tenantSlug: value })} placeholder="contoh-usaha" />
            </>}
            <Field label="NAMA OUTLET" value={form.outletName} set={(value) => setForm({ ...form, outletName: value })} />
            <Field label="KODE OUTLET" value={form.outletCode} set={(value) => setForm({ ...form, outletCode: value })} placeholder="OUTLET-01" />
            <Field label="NAMA OWNER" value={form.ownerName} set={(value) => setForm({ ...form, ownerName: value })} />
            <Field label="EMAIL OWNER" type="email" value={form.ownerEmail} set={(value) => setForm({ ...form, ownerEmail: value })} />
            <Field label="PASSWORD OWNER" type="password" value={form.ownerPassword} set={(value) => setForm({ ...form, ownerPassword: value })} minLength={8} />
            <FeeFields value={form} set={(next) => setForm({ ...form, ...next })} />
            {createOutlet.error && <div className="sm:col-span-2"><ErrorNotice error={createOutlet.error} /></div>}
            <button className="btn-primary sm:col-span-2" disabled={createOutlet.isPending}>{createOutlet.isPending ? "Membuat..." : "Buat outlet"}</button>
          </form>
        </Modal>
      )}

      {feeOutlet && (
        <Modal title={`Fee ${feeOutlet.name}`} close={() => setFeeOutlet(null)}>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); updateFee.mutate(); }}>
            <FeeFields value={fee} set={(next) => setFee({ ...fee, ...next })} />
            {updateFee.error && <div className="sm:col-span-2"><ErrorNotice error={updateFee.error} /></div>}
            <button className="btn-primary sm:col-span-2" disabled={updateFee.isPending}>Simpan fee baru</button>
          </form>
        </Modal>
      )}
      {editOutlet && (
        <Modal title={`Edit ${editOutlet.name}`} close={() => setEditOutlet(null)}>
          <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); saveOutlet.mutate(); }}>
            <Field label="NAMA OUTLET" value={outletDraft.name} set={(name) => setOutletDraft({ ...outletDraft, name })} />
            <Field label="KODE OUTLET" value={outletDraft.code} set={(code) => setOutletDraft({ ...outletDraft, code })} />
            {saveOutlet.error && <ErrorNotice error={saveOutlet.error} />}
            <button className="btn-primary" disabled={saveOutlet.isPending}>Simpan perubahan</button>
          </form>
        </Modal>
      )}
    </>
  );
}

function Field({ label, value, set, type = "text", placeholder, minLength }: { label: string; value: string; set(value: string): void; type?: string; placeholder?: string; minLength?: number }) {
  return <FormInput label={label} required type={type} value={value} placeholder={placeholder} minLength={minLength} onChange={(event) => set(event.target.value)} />;
}

function FeeFields({ value, set }: { value: { feeType?: FeeType; type?: FeeType; fixedAmount: string; percentage: string }; set(next: Partial<{ feeType: FeeType; type: FeeType; fixedAmount: string; percentage: string }>): void }) {
  const type = value.feeType ?? value.type ?? "NONE";
  const typeKey = value.feeType !== undefined ? "feeType" : "type";
  return <>
    <SearchSelect label="TIPE FEE" value={type} options={[{ value: "NONE", label: "Tanpa fee" }, { value: "FIXED", label: "Nominal tetap" }, { value: "PERCENTAGE", label: "Persentase" }, { value: "HYBRID", label: "Tetap + persentase" }]} onChange={(next) => set({ [typeKey]: next as FeeType })} />
    {(type === "FIXED" || type === "HYBRID") && <Field label="FEE TETAP" type="number" value={value.fixedAmount} set={(fixedAmount) => set({ fixedAmount })} />}
    {(type === "PERCENTAGE" || type === "HYBRID") && <Field label="PERSENTASE (%)" type="number" value={value.percentage} set={(percentage) => set({ percentage })} />}
  </>;
}

function Modal({ title, close, children }: { title: string; close(): void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center p-4"><button aria-label="Tutup" className="absolute inset-0 bg-black/55" onClick={close} /><section className="card relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black">{title}</h2><button className="btn-ghost" onClick={close}><X size={18} /></button></div>{children}</section></div>;
}
