"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import type { Category, Product, Settings, Transaction } from "@/lib/types";
import { ErrorNotice, Loading, PageHeader } from "@/components/ui";

type CartLine = { product: Product; quantity: number };
export default function PosPage() {
  const client = useQueryClient();
  const products = useQuery({
    queryKey: ["products", "active"],
    queryFn: () => api<{ data: Product[] }>("/products?activeOnly=true"),
  });
  const categories = useQuery({
    queryKey: ["categories", "active"],
    queryFn: () => api<{ data: Category[] }>("/categories?activeOnly=true"),
  });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ data: Settings }>("/settings"),
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [spicy, setSpicy] = useState(0);
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<"CASH" | "QRIS" | "TRANSFER">("CASH");
  const [received, setReceived] = useState(0);
  const [result, setResult] = useState<Transaction | null>(null);
  const transactionId = useRef<string | null>(null);
  const mutation = useMutation({
    mutationFn: (payload: unknown) =>
      api<{ data: Transaction }>("/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      setResult(data.data);
      void client.invalidateQueries();
    },
  });
  const filtered = useMemo(
    () =>
      (products.data?.data ?? []).filter(
        (p) =>
          (category === "all" || p.categoryId === category) &&
          (p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.sku.toLowerCase().includes(search.toLowerCase())),
      ),
    [products.data, category, search],
  );
  const subtotal = cart.reduce(
    (sum, line) => sum + line.product.price * line.quantity,
    0,
  );
  const taxableTotal = Math.max(0, subtotal - discount);
  const tax = settings.data?.data.taxEnabled
    ? Math.round(taxableTotal * Number(settings.data.data.taxPercentage) / 100)
    : 0;
  const total = taxableTotal + tax;
  function add(product: Product) {
    if (product.trackStock && (product.stock ?? 0) < 1) return;
    setCart((lines) => {
      const found = lines.find((l) => l.product.id === product.id);
      if (
        found &&
        product.trackStock &&
        found.quantity >= (product.stock ?? 0)
      )
        return lines;
      return found
        ? lines.map((l) =>
            l.product.id === product.id
              ? { ...l, quantity: l.quantity + 1 }
              : l,
          )
        : [...lines, { product, quantity: 1 }];
    });
  }
  function qty(id: string, delta: number) {
    setCart((lines) =>
      lines
        .map((l) => {
          if (l.product.id !== id) return l;
          const next = l.quantity + delta;
          const capped = l.product.trackStock
            ? Math.min(next, l.product.stock ?? 0)
            : next;
          return { ...l, quantity: capped };
        })
        .filter((l) => l.quantity > 0),
    );
  }
  function checkout() {
    if (!cart.length) return;
    if (!transactionId.current) transactionId.current = crypto.randomUUID();
    mutation.mutate({
      clientTransactionId: transactionId.current,
      items: cart.map((l) => ({
        productId: l.product.id,
        quantity: l.quantity,
      })),
      spicyLevel: spicy,
      notes,
      discount,
      paymentMethod: payment,
      amountReceived: payment === "CASH" ? received : undefined,
    });
  }
  function reset() {
    setCart([]);
    setSpicy(0);
    setNotes("");
    setDiscount(0);
    setReceived(0);
    setResult(null);
    transactionId.current = null;
    mutation.reset();
  }
  if (products.isLoading || categories.isLoading || settings.isLoading)
    return <Loading />;
  return (
    <>
      <PageHeader
        title="Kasir"
        description="Pilih menu, atur pesanan, lalu bayar."
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <section>
          <div className="card mb-4 p-3">
            <div className="relative">
              <Search
                className="absolute left-3 top-3 text-[#a39286]"
                size={19}
              />
              <input
                className="field pl-10"
                placeholder="Cari nama atau SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setCategory("all")}
                className={
                  category === "all"
                    ? "btn-primary whitespace-nowrap"
                    : "btn-ghost whitespace-nowrap"
                }
              >
                Semua
              </button>
              {categories.data?.data.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCategory(item.id)}
                  className={
                    category === item.id
                      ? "btn-primary whitespace-nowrap"
                      : "btn-ghost whitespace-nowrap"
                  }
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => (
              <button
                key={product.id}
                onClick={() => add(product)}
                disabled={product.trackStock && (product.stock ?? 0) < 1}
                className="card group min-h-36 p-4 text-left transition hover:-translate-y-1 hover:border-[#f1a080] hover:shadow-lg"
              >
                <div className="flex justify-between gap-3">
                  <span className="badge bg-[#fff0e8] text-[#bd3519]">
                    {product.category.name}
                  </span>
                  {product.trackStock && (
                    <span className="text-xs font-bold text-[#796c63]">
                      Stok {product.stock}
                    </span>
                  )}
                </div>
                <h3 className="mt-5 text-lg font-black group-hover:text-[#e7562c]">
                  {product.name}
                </h3>
                <p className="mt-1 text-xs text-[#9b8a7d]">{product.sku}</p>
                <p className="mt-3 font-black text-[#477a52]">
                  {rupiah(product.price)}
                </p>
              </button>
            ))}
          </div>
          {!filtered.length && (
            <p className="card p-10 text-center text-[#796c63]">
              Produk tidak ditemukan.
            </p>
          )}
        </section>
        <aside className="card h-fit overflow-hidden xl:sticky xl:top-8">
          <div className="flex items-center gap-3 border-b border-[#eadfd3] p-5">
            <span className="rounded-xl bg-[#2b1c15] p-2 text-white">
              <ShoppingCart size={20} />
            </span>
            <div>
              <h2 className="font-black">Pesanan</h2>
              <p className="text-xs text-[#796c63]">
                {cart.reduce((s, l) => s + l.quantity, 0)} item
              </p>
            </div>
          </div>
          <div className="max-h-[38vh] space-y-3 overflow-y-auto p-4">
            {cart.map((line) => (
              <div
                key={line.product.id}
                className="rounded-xl border border-[#eee3d9] p-3"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-bold">{line.product.name}</p>
                    <p className="text-xs text-[#796c63]">
                      {rupiah(line.product.price)}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setCart((v) =>
                        v.filter((x) => x.product.id !== line.product.id),
                      )
                    }
                    className="text-red-500"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 rounded-lg bg-[#fff8f1] p-1">
                    <button
                      className="p-1"
                      onClick={() => qty(line.product.id, -1)}
                    >
                      <Minus size={16} />
                    </button>
                    <b>{line.quantity}</b>
                    <button
                      className="p-1"
                      onClick={() => qty(line.product.id, 1)}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <b>{rupiah(line.product.price * line.quantity)}</b>
                </div>
              </div>
            ))}
            {!cart.length && (
              <div className="py-10 text-center text-sm text-[#9b8a7d]">
                <ShoppingCart className="mx-auto mb-3 opacity-30" />
                Keranjang masih kosong
              </div>
            )}
          </div>
          <div className="space-y-4 border-t border-[#eadfd3] bg-[#fffdfa] p-5">
            <div>
              <span className="label">LEVEL PEDAS</span>
              <div className="grid grid-cols-6 gap-1">
                {[0, 1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    onClick={() => setSpicy(level)}
                    className={`rounded-lg py-2 text-sm font-black ${spicy === level ? "bg-[#e7562c] text-white" : "bg-white ring-1 ring-[#eadfd3]"}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
            <label>
              <span className="label">CATATAN</span>
              <input
                className="field"
                value={notes}
                maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: kuah sedikit"
              />
            </label>
            <label>
              <span className="label">DISKON NOMINAL</span>
              <input
                className="field"
                type="number"
                min={0}
                max={subtotal}
                value={discount}
                onChange={(e) =>
                  setDiscount(
                    Math.min(subtotal, Math.max(0, Number(e.target.value))),
                  )
                }
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "QRIS", "TRANSFER"] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPayment(method)}
                  className={payment === method ? "btn-primary" : "btn-ghost"}
                >
                  {method}
                </button>
              ))}
            </div>
            {payment === "CASH" && (
              <label>
                <span className="label">UANG DITERIMA</span>
                <input
                  className="field"
                  type="number"
                  min={total}
                  value={received || ""}
                  onChange={(e) => setReceived(Number(e.target.value))}
                />
              </label>
            )}
            <div className="space-y-2 border-t border-dashed border-[#d8c8ba] pt-4 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <b>{rupiah(subtotal)}</b>
              </div>
              <div className="flex justify-between">
                <span>Diskon</span>
                <b>-{rupiah(discount)}</b>
              </div>
              {tax > 0 && (
                <div className="flex justify-between">
                  <span>Pajak</span>
                  <b>{rupiah(tax)}</b>
                </div>
              )}
              <div className="flex justify-between text-xl">
                <span className="font-black">Total</span>
                <b className="text-[#e7562c]">{rupiah(total)}</b>
              </div>
            </div>
            {mutation.error && <ErrorNotice error={mutation.error} />}
            <button
              className="btn-primary w-full"
              disabled={
                !cart.length ||
                mutation.isPending ||
                (payment === "CASH" && received < total)
              }
              onClick={checkout}
            >
              {mutation.isPending ? "Memproses..." : "Bayar sekarang"}
            </button>
          </div>
        </aside>
      </div>
      {result && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
          <div className="card w-full max-w-md p-6">
            <button onClick={() => setResult(null)} className="float-right">
              <X />
            </button>
            <CheckCircle2 className="mb-4 text-emerald-600" size={50} />
            <h2 className="text-2xl font-black">Transaksi berhasil</h2>
            <p className="mt-1 text-sm text-[#796c63]">{result.invoiceNo}</p>
            <div className="my-6 rounded-xl bg-[#fff7ef] p-4">
              <div className="flex justify-between">
                <span>Total</span>
                <b>{rupiah(result.total)}</b>
              </div>
              {result.paymentMethod === "CASH" && (
                <>
                  <div className="mt-2 flex justify-between">
                    <span>Diterima</span>
                    <b>{rupiah(result.amountReceived ?? 0)}</b>
                  </div>
                  <div className="mt-2 flex justify-between text-emerald-700">
                    <span>Kembalian</span>
                    <b>{rupiah(result.changeAmount)}</b>
                  </div>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link className="btn-ghost text-center" href={`/transactions/${result.id}`}>
                Lihat & cetak
              </Link>
              <button className="btn-primary" onClick={reset}>
                Transaksi baru
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
