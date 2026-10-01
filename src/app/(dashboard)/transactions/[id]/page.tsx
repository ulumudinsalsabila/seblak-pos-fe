"use client";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { api } from "@/lib/api";
import type { Transaction } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { Receipt } from "@/components/receipt";
import { ErrorNotice, Loading, PageHeader, StatusBadge } from "@/components/ui";
export default function TransactionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user } = useAuth();
  const client = useQueryClient();
  const [reason, setReason] = useState("");
  const query = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => api<{ data: Transaction }>(`/transactions/${id}`),
  });
  const voidMutation = useMutation({
    mutationFn: () =>
      api(`/transactions/${id}/void`, {
        method: "POST",
        body: JSON.stringify({ voidReason: reason }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["transaction", id] });
      void client.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorNotice error={query.error} />;
  const transaction = query.data!.data;
  return (
    <>
      <div className="no-print">
        <PageHeader
          title={transaction.invoiceNo}
          description="Detail transaksi dan receipt snapshot."
          action={
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => window.print()}
            >
              <Printer size={18} />
              Cetak struk
            </button>
          }
        />
        <div className="mb-6 flex items-center gap-3">
          <StatusBadge status={transaction.status} />
          <span className="text-sm font-bold text-[#796c63]">
            {transaction.paymentMethod}
          </span>
        </div>
        {user?.role === "OWNER" && transaction.status === "PAID" && (
          <div className="card mx-auto mb-6 max-w-[80mm] p-4">
            <span className="label">ALASAN VOID</span>
            <div className="flex gap-2">
              <input
                className="field"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Minimal 3 karakter"
              />
              <button
                disabled={reason.trim().length < 3 || voidMutation.isPending}
                className="rounded-xl bg-red-600 px-4 font-bold text-white disabled:opacity-40"
                onClick={() => voidMutation.mutate()}
              >
                Void
              </button>
            </div>
            {voidMutation.error && (
              <div className="mt-3">
                <ErrorNotice error={voidMutation.error} />
              </div>
            )}
          </div>
        )}
      </div>
      <Receipt transaction={transaction} />
    </>
  );
}
