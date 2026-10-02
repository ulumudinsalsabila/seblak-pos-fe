"use client";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { api } from "@/lib/api";
import type { Transaction } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { KitchenReceipt, Receipt } from "@/components/receipt";
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
  const [receiptMode, setReceiptMode] = useState<"customer" | "kitchen">(
    "customer",
  );
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
  function printReceipt(mode: "customer" | "kitchen") {
    setReceiptMode(mode);
    window.setTimeout(() => window.print(), 0);
  }
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
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-primary flex items-center gap-2 !bg-[#2b1c15]"
                onClick={() => printReceipt("kitchen")}
              >
                <Printer size={18} />
                Print dapur
              </button>
              <button
                className="btn-primary flex items-center gap-2"
                onClick={() => printReceipt("customer")}
              >
                <Printer size={18} />
                Print customer
              </button>
            </div>
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
        <div className="mx-auto mb-4 grid max-w-[80mm] grid-cols-2 gap-2 rounded-2xl border border-[#eadfd3] bg-white p-2">
          <button
            type="button"
            className={receiptMode === "customer" ? "btn-primary" : "btn-ghost"}
            onClick={() => setReceiptMode("customer")}
          >
            Nota customer
          </button>
          <button
            type="button"
            className={receiptMode === "kitchen" ? "btn-primary" : "btn-ghost"}
            onClick={() => setReceiptMode("kitchen")}
          >
            Nota dapur
          </button>
        </div>
        {receiptMode === "customer" ? (
          <Receipt transaction={transaction} />
        ) : (
          <KitchenReceipt transaction={transaction} />
        )}
      </div>
      <div className="print-only">
        {receiptMode === "customer" ? (
          <Receipt transaction={transaction} />
        ) : (
          <KitchenReceipt transaction={transaction} />
        )}
      </div>
    </>
  );
}
