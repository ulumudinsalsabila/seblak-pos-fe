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
  UtensilsCrossed,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import type { Category, Product, Settings, Transaction } from "@/lib/types";
import { ErrorNotice, Loading } from "@/components/ui";

type CartLine = { product: Product; quantity: number };
const choiceClass = (active: boolean) =>
  active ? "btn-primary py-2.5" : "btn-ghost py-2.5";
const categoryClass = (active: boolean) =>
  [
    "shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-extrabold transition",
    active
      ? "bg-[#e7562c] text-white shadow-sm hover:bg-[#bd3519]"
      : "border border-[#eadfd3] bg-white text-[#493a31] hover:border-[#f1a080] hover:bg-[#fff3ec] hover:text-[#d94722]",
  ].join(" ");

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
  const [customerName, setCustomerName] = useState("");
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">(
    "DINE_IN",
  );
  const [spicy, setSpicy] = useState(0);
  const [brothLevel, setBrothLevel] = useState<"LITTLE" | "MEDIUM" | "MUCH">(
    "MEDIUM",
  );
  const [tastePreference, setTastePreference] = useState<
    "SALTY" | "SAVORY" | "SWEET"
  >("SAVORY");
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
      customerName: customerName.trim(),
      orderType,
      spicyLevel: spicy,
      brothLevel,
      tastePreference,
      notes,
      discount,
      paymentMethod: payment,
      amountReceived: payment === "CASH" ? received : undefined,
    });
  }
  function reset() {
    setCart([]);
    setCustomerName("");
    setOrderType("DINE_IN");
    setSpicy(0);
    setBrothLevel("MEDIUM");
    setTastePreference("SAVORY");
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
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px] 2xl:grid-cols-[minmax(0,1fr)_500px]">
        <section className="min-w-0">
          <div className="card sticky top-20 z-10 mb-5 bg-[#fffdfa]/95 p-3 shadow-[0_14px_35px_rgba(75,47,31,0.12)] backdrop-blur-xl sm:p-4">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-[#6f6259]">
                <Search size={20} />
              </span>
              <input
                className="field field-with-icon min-h-12 bg-white/95 text-sm sm:text-base"
                placeholder="Cari menu atau SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div
              className="mt-3 flex max-w-full snap-x gap-2 overflow-x-auto pb-1 [scrollbar-color:#e7b39f_transparent] [scrollbar-width:thin]"
              aria-label="Filter kategori produk"
            >
              <button
                type="button"
                aria-pressed={category === "all"}
                onClick={() => setCategory("all")}
                className={`${categoryClass(category === "all")} snap-start`}
              >
                Semua
              </button>
              {categories.data?.data.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={category === item.id}
                  onClick={() => setCategory(item.id)}
                  className={`${categoryClass(category === item.id)} snap-start`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((product) => (
              <button
                key={product.id}
                onClick={() => add(product)}
                disabled={product.trackStock && (product.stock ?? 0) < 1}
                className="card group overflow-hidden p-3 text-left transition hover:-translate-y-1 hover:border-[#f1a080] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div
                  className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#fff0e8] to-[#f7d7bd] bg-cover bg-center"
                  style={
                    product.imageUrl
                      ? { backgroundImage: `url(${JSON.stringify(product.imageUrl)})` }
                      : undefined
                  }
                >
                  {!product.imageUrl && (
                    <UtensilsCrossed size={42} className="text-[#e7562c]/45" />
                  )}
                  {product.trackStock && (
                    <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-[#796c63] shadow-sm">
                      Stok {product.stock}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-xs font-bold text-[#9b8a7d]">
                  {product.category.name}
                </p>
                <h3 className="mt-1 line-clamp-2 min-h-12 text-base font-black group-hover:text-[#e7562c]">
                  {product.name}
                </h3>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="font-black text-[#e7562c]">
                    {rupiah(product.price)}
                  </p>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f04e2a] text-white shadow-sm transition group-hover:scale-105">
                    <Plus size={22} />
                  </span>
                </div>
              </button>
            ))}
          </div>
          {!filtered.length && (
            <p className="card p-10 text-center text-[#796c63]">
              Produk tidak ditemukan.
            </p>
          )}
        </section>
        <aside className="card h-fit overflow-hidden xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <div className="flex items-center gap-3 border-b border-[#eadfd3] p-5">
            <ShoppingCart size={28} />
            <div className="flex-1">
              <h2 className="text-xl font-black">
                Pesanan{" "}
                <span className="text-[#e7562c]">
                  ({cart.reduce((s, l) => s + l.quantity, 0)})
                </span>
              </h2>
            </div>
            <button
              aria-label="Kosongkan pesanan"
              title="Kosongkan pesanan"
              disabled={!cart.length}
              onClick={() => setCart([])}
              className="rounded-xl bg-red-50 p-2.5 text-red-500 disabled:opacity-30"
            >
              <Trash2 size={20} />
            </button>
          </div>
          <div className="max-h-[28vh] min-h-36 space-y-3 overflow-y-auto p-4">
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
              <div className="py-8 text-center text-sm text-[#9b8a7d]">
                <ShoppingCart className="mx-auto mb-3 opacity-30" />
                Keranjang masih kosong
              </div>
            )}
          </div>
          <div className="space-y-5 border-t border-[#eadfd3] bg-[#fffdfa] p-5">
            <label>
              <span className="label">NAMA CUSTOMER</span>
              <input
                className="field"
                value={customerName}
                maxLength={100}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Masukkan nama customer"
              />
            </label>
            <div className="rounded-xl bg-[#fff1e9] p-4">
              <p className="mb-4 font-black">Pilihan pesanan</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <span className="label">TEMPAT</span>
                  <div className="grid gap-2">
                    <button
                      onClick={() => setOrderType("DINE_IN")}
                      className={choiceClass(orderType === "DINE_IN")}
                    >
                      Makan di tempat
                    </button>
                    <button
                      onClick={() => setOrderType("TAKEAWAY")}
                      className={choiceClass(orderType === "TAKEAWAY")}
                    >
                      Bungkus
                    </button>
                  </div>
                </div>
                <div>
                  <span className="label">RASA</span>
                  <div className="grid gap-2">
                    {([
                      ["SALTY", "Asin"],
                      ["SAVORY", "Gurih"],
                      ["SWEET", "Manis"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setTastePreference(value)}
                        className={choiceClass(tastePreference === value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="label">LEVEL PEDAS</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        onClick={() => setSpicy(level)}
                        className={choiceClass(spicy === level)}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="label">KUAH</span>
                  <div className="grid gap-2">
                    {([
                      ["LITTLE", "Sedikit"],
                      ["MEDIUM", "Sedang"],
                      ["MUCH", "Banyak"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => setBrothLevel(value)}
                        className={choiceClass(brothLevel === value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <label>
              <span className="label">CATATAN</span>
              <input
                className="field"
                value={notes}
                maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: tanpa topping, dll"
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
                !customerName.trim() ||
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
            <p className="mt-1 text-sm text-[#796c63]">
              {result.customerName} · {result.invoiceNo}
            </p>
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
