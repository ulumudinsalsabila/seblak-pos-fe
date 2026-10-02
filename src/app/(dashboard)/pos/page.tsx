"use client";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Printer,
  Search,
  SlidersHorizontal,
  ShoppingCart,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import type { Category, MenuOptionGroup, Product, SelectedMenuOption, Settings, Transaction } from "@/lib/types";
import { KitchenReceipt, Receipt } from "@/components/receipt";
import { ErrorNotice, Loading } from "@/components/ui";

type ItemOptions = {
  spicyLevel: number;
  brothLevel: "LITTLE" | "MEDIUM" | "MUCH";
  tastePreference: "SALTY" | "SAVORY" | "SWEET";
  notes: string;
  selectedOptions: SelectedMenuOption[];
};
type CartLine = { product: Product; quantity: number; options: ItemOptions };
const defaultItemOptions = (product?: Product, groups: MenuOptionGroup[] = []): ItemOptions => ({
  spicyLevel: 0,
  brothLevel: "MEDIUM",
  tastePreference: "SAVORY",
  notes: "",
  selectedOptions: groups
    .filter((group) => group.isActive && product && group.categoryIds.includes(product.categoryId))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((group) => {
      const value = group.values.find((item) => item.isDefault) ?? group.values[0];
      return value ? [{ groupId: group.id, groupName: group.name, valueId: value.id, valueLabel: value.label }] : [];
    }),
});
const choiceClass = (active: boolean) =>
  active
    ? "btn-primary !px-2 !py-1.5 text-xs"
    : "btn-ghost !px-2 !py-1.5 text-xs";
const categoryClass = (active: boolean) =>
  [
    "grow whitespace-nowrap rounded-full px-2 py-1 text-[9px] font-extrabold leading-4 transition",
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
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);
  const [customerName, setCustomerName] = useState("");
  const [orderType, setOrderType] = useState<"DINE_IN" | "TAKEAWAY">("DINE_IN");
  const [spicy, setSpicy] = useState(0);
  const [brothLevel, setBrothLevel] = useState<"LITTLE" | "MEDIUM" | "MUCH">(
    "MEDIUM",
  );
  const [tastePreference, setTastePreference] = useState<
    "SALTY" | "SAVORY" | "SWEET"
  >("SAVORY");
  const [notes, setNotes] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [draftOptions, setDraftOptions] = useState<ItemOptions>(defaultItemOptions());
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<"CASH" | "QRIS" | "TRANSFER">("CASH");
  const [received, setReceived] = useState(0);
  const [result, setResult] = useState<Transaction | null>(null);
  const [receiptMode, setReceiptMode] = useState<"customer" | "kitchen">(
    "customer",
  );
  const transactionId = useRef<string | null>(null);
  const mutation = useMutation({
    mutationFn: (payload: unknown) =>
      api<{ data: Transaction }>("/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (data) => {
      setReceiptMode("customer");
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
    ? Math.round(
        (taxableTotal * Number(settings.data.data.taxPercentage)) / 100,
      )
    : 0;
  const total = taxableTotal + tax;
  function add(product: Product) {
    if (product.trackStock && (product.stock ?? 0) < 1) return;
    setCart((lines) => {
      const found = lines.find((l) => l.product.id === product.id);
      if (found && product.trackStock && found.quantity >= (product.stock ?? 0))
        return lines;
      return found
        ? lines.map((l) =>
            l.product.id === product.id
              ? { ...l, quantity: l.quantity + 1 }
              : l,
          )
        : [...lines, { product, quantity: 1, options: defaultItemOptions(product, settings.data?.data.menuOptions ?? []) }];
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
        ...l.options,
        notes: l.options.notes.trim(),
      })),
      customerName: customerName.trim(),
      orderType,
      spicyLevel: cart[0]?.options.spicyLevel ?? 0,
      brothLevel: cart[0]?.options.brothLevel ?? "MEDIUM",
      tastePreference: cart[0]?.options.tastePreference ?? "SAVORY",
      notes: "",
      discount,
      paymentMethod: payment,
      amountReceived: payment === "CASH" ? received : undefined,
    });
  }
  function reset() {
    setCart([]);
    setIsCartOpen(false);
    setCheckoutStep(1);
    setCustomerName("");
    setOrderType("DINE_IN");
    setSpicy(0);
    setBrothLevel("MEDIUM");
    setTastePreference("SAVORY");
    setNotes("");
    setDiscount(0);
    setReceived(0);
    setResult(null);
    setReceiptMode("customer");
    transactionId.current = null;
    mutation.reset();
  }
  function printResult(mode: "customer" | "kitchen") {
    setReceiptMode(mode);
    window.setTimeout(() => window.print(), 0);
  }
  if (products.isLoading || categories.isLoading || settings.isLoading)
    return <Loading />;
  return (
    <>
      <div className="no-print grid items-start gap-6 pb-20 xl:grid-cols-[minmax(0,1fr)_440px] xl:pb-0 2xl:grid-cols-[minmax(0,1fr)_500px]">
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
              className="mt-2 flex max-w-full flex-wrap gap-1"
              aria-label="Filter kategori produk"
            >
              <button
                type="button"
                aria-pressed={category === "all"}
                onClick={() => setCategory("all")}
                className={categoryClass(category === "all")}
              >
                Semua
              </button>
              {categories.data?.data.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={category === item.id}
                  onClick={() => setCategory(item.id)}
                  className={categoryClass(category === item.id)}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
                      ? {
                          backgroundImage: `url(${JSON.stringify(product.imageUrl)})`,
                        }
                      : undefined
                  }
                >
                  {!product.imageUrl && (
                    <UtensilsCrossed size={42} className="text-[#e7562c]/45" />
                  )}
                  {product.trackStock && (
                    <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-[#796c63] shadow-sm">
                      Stok {product.stock}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[10px] font-bold text-[#9b8a7d]">
                  {product.category.name}
                </p>
                <h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-black group-hover:text-[#e7562c]">
                  {product.name}
                </h3>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-[#e7562c]">
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
        {isCartOpen && (
          <button
            type="button"
            aria-label="Tutup panel pesanan"
            className="fixed inset-0 z-20 bg-black/35 backdrop-blur-[1px] xl:hidden"
            onClick={() => setIsCartOpen(false)}
          />
        )}
        <aside className="card fixed bottom-3 left-3 right-3 z-30 flex max-h-[calc(100dvh-5.5rem)] flex-col overflow-clip shadow-[0_-12px_35px_rgba(75,47,31,0.18)] lg:left-[100px] xl:sticky xl:inset-auto xl:top-20 xl:z-auto xl:h-fit xl:max-h-[calc(100vh-6rem)]">
          {!isCartOpen && (
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left xl:hidden"
              onClick={() => {
                if (checkoutStep === 2) setCheckoutStep(1);
                setIsCartOpen(true);
              }}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fff0e8] text-[#e7562c]">
                <ShoppingCart size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black">
                  {cart.length
                    ? `${cart.reduce((sum, line) => sum + line.quantity, 0)} item dalam pesanan`
                    : "Keranjang masih kosong"}
                </span>
                <span className="block text-xs font-bold text-[#796c63]">
                  {cart.length ? "Ketuk untuk detail & pembayaran" : "Pilih menu untuk mulai memesan"}
                </span>
              </span>
              <span className="text-right">
                <b className="block text-sm text-[#e7562c]">
                  {rupiah(total)}
                </b>
                <ChevronUp className="ml-auto mt-0.5 text-[#796c63]" size={18} />
              </span>
            </button>
          )}
          <div
            className={`${isCartOpen ? "flex" : "hidden"} min-h-0 flex-col xl:flex xl:flex-1`}
          >
          <div className="flex shrink-0 items-center gap-3 border-b border-[#eadfd3] p-3 xl:p-5">
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
              type="button"
              aria-label="Tutup panel pesanan"
              onClick={() => setIsCartOpen(false)}
              className="rounded-xl border border-[#eadfd3] bg-white p-2.5 text-[#796c63] xl:hidden"
            >
              <ChevronDown size={20} />
            </button>
            <button
              type="button"
              aria-label="Kosongkan pesanan"
              title="Kosongkan pesanan"
              disabled={!cart.length}
              onClick={() => {
                setCart([]);
                setCheckoutStep(1);
              }}
              className="rounded-xl bg-red-50 p-2.5 text-red-500 disabled:opacity-30"
            >
              <Trash2 size={20} />
            </button>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-[#eadfd3] bg-[#fffdfa] px-3 py-2 xl:px-4 xl:py-3">
            {(
              [
                [1, "Pesanan"],
                [3, "Bayar"],
              ] as const
            ).map(([step, label]) => {
              const disabled =
                step === 3 && (!cart.length || !customerName.trim());
              const active = checkoutStep === step;
              const complete = checkoutStep > step;

              return (
                <button
                  type="button"
                  key={step}
                  disabled={disabled}
                  onClick={() => setCheckoutStep(step)}
                  className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-extrabold transition sm:text-sm ${
                    active
                      ? "bg-[#e7562c] text-white shadow-sm"
                      : complete
                        ? "bg-[#fff0e8] text-[#d94722]"
                        : "bg-[#f7f2ed] text-[#8b7b70]"
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ${
                      active ? "bg-white/20" : "bg-white"
                    }`}
                  >
                    {step}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>

          {checkoutStep === 1 && (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid gap-2 border-b border-[#eadfd3] bg-[#fffdfa] p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  className="field !min-h-10 !py-2 text-sm"
                  value={customerName}
                  maxLength={100}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Nama customer"
                />
                <div className="grid grid-cols-2 gap-1">
                  <button type="button" onClick={() => setOrderType("DINE_IN")} className={choiceClass(orderType === "DINE_IN")}>Makan sini</button>
                  <button type="button" onClick={() => setOrderType("TAKEAWAY")} className={choiceClass(orderType === "TAKEAWAY")}>Bungkus</button>
                </div>
              </div>
              <div className="max-h-[42vh] min-h-48 space-y-3 overflow-y-auto p-4">
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
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { setEditingProductId(line.product.id); setDraftOptions({ ...line.options }); }} className="flex items-center gap-1 rounded-lg border border-[#eadfd3] px-2 py-1 text-xs font-bold text-[#e7562c]">
                          <SlidersHorizontal size={14} /> Opsi
                        </button>
                        <button
                          type="button"
                          aria-label={`Hapus ${line.product.name}`}
                          onClick={() => setCart((value) => value.filter((item) => item.product.id !== line.product.id))}
                          className="text-red-500"
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-[#796c63]">{itemOptionsLabel(line.options)}</p>
                    {line.options.notes && <p className="mt-1 text-xs italic text-[#493a31]">Catatan: {line.options.notes}</p>}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 rounded-lg bg-[#fff8f1] p-1">
                        <button
                          type="button"
                          aria-label={`Kurangi ${line.product.name}`}
                          className="p-1"
                          onClick={() => qty(line.product.id, -1)}
                        >
                          <Minus size={16} />
                        </button>
                        <b>{line.quantity}</b>
                        <button
                          type="button"
                          aria-label={`Tambah ${line.product.name}`}
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
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#796c63]">Subtotal</span>
                  <b className="text-lg">{rupiah(subtotal)}</b>
                </div>
                <button
                  type="button"
                  className="btn-primary w-full"
                  disabled={!cart.length || !customerName.trim()}
                  onClick={() => setCheckoutStep(3)}
                >
                  Ke pembayaran
                </button>
              </div>
            </div>
          )}

          {checkoutStep === 2 && (
            <div className="flex min-h-0 flex-1 flex-col bg-[#fffdfa]">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4 xl:space-y-5 xl:p-5">
              <label>
                <span className="label">NAMA CUSTOMER</span>
                <input
                  autoFocus
                  className="field"
                  value={customerName}
                  maxLength={100}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Masukkan nama customer"
                />
              </label>
              <div className="rounded-xl bg-[#fff1e9] p-3 xl:p-4">
                <p className="mb-3 font-black xl:mb-4">Pilihan pesanan</p>
                <div className="grid grid-cols-2 gap-3 xl:gap-5">
                  <div>
                    <span className="label">TEMPAT</span>
                    <div className="grid gap-2">
                      <button
                        type="button"
                        onClick={() => setOrderType("DINE_IN")}
                        className={choiceClass(orderType === "DINE_IN")}
                      >
                        Makan di tempat
                      </button>
                      <button
                        type="button"
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
                      {(
                        [
                          ["SALTY", "Asin"],
                          ["SAVORY", "Gurih"],
                          ["SWEET", "Manis"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          type="button"
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
                          type="button"
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
                      {(
                        [
                          ["LITTLE", "Sedikit"],
                          ["MEDIUM", "Sedang"],
                          ["MUCH", "Banyak"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          type="button"
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
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#eadfd3] bg-[#fffdfa] p-3 shadow-[0_-10px_24px_rgba(75,47,31,0.06)] xl:p-4">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setCheckoutStep(1)}
                >
                  Kembali
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!customerName.trim()}
                  onClick={() => setCheckoutStep(3)}
                >
                  Ke pembayaran
                </button>
              </div>
            </div>
          )}

          {checkoutStep === 3 && (
            <div className="flex min-h-0 flex-1 flex-col bg-[#fffdfa]">
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 xl:space-y-4 xl:p-5">
                <div className="rounded-xl border border-[#eadfd3] bg-white p-3 xl:p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#796c63]">
                    Customer
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <b className="truncate">{customerName}</b>
                    <button
                      type="button"
                      className="text-sm font-bold text-[#e7562c]"
                      onClick={() => setCheckoutStep(1)}
                    >
                      Ubah
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-[#eadfd3] bg-white p-3 xl:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">Ringkasan pesanan</p>
                      <p className="text-xs text-[#796c63]">
                        {cart.reduce((sum, line) => sum + line.quantity, 0)}{" "}
                        item
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-sm font-bold text-[#e7562c]"
                      onClick={() => setCheckoutStep(1)}
                    >
                      Ubah
                    </button>
                  </div>
                  <div className="divide-y divide-[#eee3d9]">
                    {cart.map((line) => (
                      <div
                        key={line.product.id}
                        className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">
                            {line.product.name}
                          </p>
                          <p className="mt-0.5 text-xs text-[#796c63]">
                            {line.quantity} × {rupiah(line.product.price)}
                          </p>
                        </div>
                        <b className="shrink-0 text-sm">
                          {rupiah(line.product.price * line.quantity)}
                        </b>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 z-10 shrink-0 space-y-2 border-t border-[#eadfd3] bg-[#fffdfa]/98 p-3 shadow-[0_-14px_30px_rgba(75,47,31,0.08)] backdrop-blur-xl xl:space-y-4 xl:p-5">
                <div className="grid grid-cols-[minmax(110px,0.8fr)_minmax(0,2fr)] items-end gap-2">
                  <label>
                    <span className="label">DISKON NOMINAL</span>
                    <input
                      className="field !min-h-9 !py-1.5 text-sm"
                      type="number"
                      min={0}
                      max={subtotal}
                      value={discount}
                      onChange={(e) =>
                        setDiscount(
                          Math.min(
                            subtotal,
                            Math.max(0, Number(e.target.value)),
                          ),
                        )
                      }
                    />
                  </label>
                  <div>
                    <span className="label">METODE PEMBAYARAN</span>
                    <div className="grid grid-cols-3 gap-2">
                      {(["CASH", "QRIS", "TRANSFER"] as const).map(
                        (method) => (
                          <button
                            type="button"
                            key={method}
                            onClick={() => setPayment(method)}
                            className={
                              payment === method
                                ? "btn-primary !px-2 !py-1.5 text-xs"
                                : "btn-ghost !px-2 !py-1.5 text-xs"
                            }
                          >
                            {method}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
                {payment === "CASH" && (
                  <label>
                    <span className="label">UANG DITERIMA</span>
                    <input
                      className="field !min-h-9 !py-1.5 text-sm"
                      type="number"
                      min={total}
                      value={received || ""}
                      onChange={(e) => setReceived(Number(e.target.value))}
                      placeholder={rupiah(total)}
                    />
                  </label>
                )}
                <div className="space-y-1 rounded-xl bg-[#fff1e9] p-3 text-xs xl:space-y-2 xl:p-4 xl:text-sm">
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
                  <div className="flex justify-between border-t border-dashed border-[#d8c8ba] pt-2 text-base xl:pt-3 xl:text-xl">
                    <span className="font-black">Total</span>
                    <b className="text-[#e7562c]">{rupiah(total)}</b>
                  </div>
                  {payment === "CASH" && received >= total && (
                    <div className="flex justify-between font-bold text-emerald-700">
                      <span>Kembalian</span>
                      <span>{rupiah(received - total)}</span>
                    </div>
                  )}
                </div>
                {mutation.error && <ErrorNotice error={mutation.error} />}
                <div className="grid grid-cols-[auto_1fr] gap-3">
                  <button
                    type="button"
                    className="btn-ghost !px-3 !py-2 text-xs"
                    onClick={() => setCheckoutStep(1)}
                  >
                    Kembali
                  </button>
                  <button
                    type="button"
                    className="btn-primary !px-3 !py-2 text-xs"
                    disabled={
                      !cart.length ||
                      !customerName.trim() ||
                      mutation.isPending ||
                      (payment === "CASH" && received < total)
                    }
                    onClick={checkout}
                  >
                    {mutation.isPending
                      ? "Memproses..."
                      : `Bayar ${rupiah(total)}`}
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        </aside>
      </div>
      {editingProductId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm">
          <button type="button" aria-label="Tutup opsi menu" className="absolute inset-0" onClick={() => setEditingProductId(null)} />
          <div role="dialog" aria-modal="true" aria-labelledby="item-options-title" className="relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div><p className="text-xs font-bold uppercase tracking-wide text-[#e7562c]">Detail per menu</p><h2 id="item-options-title" className="text-xl font-black">Opsi menu</h2></div>
              <button type="button" className="rounded-xl border border-[#eadfd3] p-2" onClick={() => setEditingProductId(null)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              {(settings.data?.data.menuOptions ?? []).filter((group) => {
                const line = cart.find((item) => item.product.id === editingProductId);
                return group.isActive && Boolean(line && group.categoryIds.includes(line.product.categoryId));
              }).sort((a, b) => a.sortOrder - b.sortOrder).map((group) => (
                <OptionChoices key={group.id} label={group.name} value={draftOptions.selectedOptions.find((selected) => selected.groupId === group.id)?.valueId ?? ""} items={group.values.map((value) => [value.id, value.label])} onChange={(valueId) => {
                  const selectedValue = group.values.find((value) => value.id === valueId);
                  if (!selectedValue) return;
                  setDraftOptions((current) => ({ ...current, selectedOptions: [...current.selectedOptions.filter((selected) => selected.groupId !== group.id), { groupId: group.id, groupName: group.name, valueId: selectedValue.id, valueLabel: selectedValue.label }] }));
                }} />
              ))}
              <label><span className="label">CATATAN</span><textarea className="field min-h-24 resize-none" value={draftOptions.notes} maxLength={500} onChange={(event) => setDraftOptions((value) => ({ ...value, notes: event.target.value }))} placeholder="Contoh: tanpa topping, dll" /></label>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" className="btn-ghost" onClick={() => setEditingProductId(null)}>Batal</button>
              <button type="button" className="btn-primary" onClick={() => { setCart((lines) => lines.map((line) => line.product.id === editingProductId ? { ...line, options: draftOptions } : line)); setEditingProductId(null); }}>Simpan opsi</button>
            </div>
          </div>
        </div>
      )}
      {result && (
        <>
          <div className="no-print fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-sm">
            <button
              type="button"
              aria-label="Tutup preview nota"
              className="absolute inset-0 cursor-default"
              onClick={reset}
            />
            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby="receipt-drawer-title"
              className="relative z-10 flex h-full w-full max-w-lg flex-col bg-[#f8f3ed] shadow-[-20px_0_50px_rgba(36,28,23,0.2)]"
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#eadfd3] bg-white p-5">
                <div>
                  <p className="text-sm font-bold text-emerald-700">
                    Transaksi berhasil
                  </p>
                  <h2 id="receipt-drawer-title" className="text-xl font-black">
                    Preview nota
                  </h2>
                  <p className="mt-1 text-sm text-[#796c63]">
                    {result.customerName} · {result.invoiceNo}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Tutup"
                  className="rounded-xl border border-[#eadfd3] bg-white p-2 text-[#796c63]"
                  onClick={reset}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-[#eadfd3] bg-white px-5 py-3">
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
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {receiptMode === "customer" ? (
                  <Receipt transaction={result} />
                ) : (
                  <KitchenReceipt transaction={result} />
                )}
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#eadfd3] bg-white p-5">
                <button
                  type="button"
                  className="btn-primary flex items-center justify-center gap-2 !bg-[#2b1c15]"
                  onClick={() => printResult("kitchen")}
                >
                  <Printer size={18} />
                  Print dapur
                </button>
                <button
                  type="button"
                  className="btn-primary flex items-center justify-center gap-2"
                  onClick={() => printResult("customer")}
                >
                  <Printer size={18} />
                  Print customer
                </button>
              </div>
            </aside>
          </div>
          <div className="print-only">
            {receiptMode === "customer" ? (
              <Receipt transaction={result} />
            ) : (
              <KitchenReceipt transaction={result} />
            )}
          </div>
        </>
      )}
    </>
  );
}

function itemOptionsLabel(options: ItemOptions) {
  if (options.selectedOptions.length)
    return options.selectedOptions.map((option) => `${option.groupName}: ${option.valueLabel}`).join(" · ");
  const taste = { SALTY: "Asin", SAVORY: "Gurih", SWEET: "Manis" }[options.tastePreference];
  const broth = { LITTLE: "Kuah sedikit", MEDIUM: "Kuah sedang", MUCH: "Kuah banyak" }[options.brothLevel];
  return `${taste} · Pedas ${options.spicyLevel} · ${broth}`;
}

function OptionChoices({ label, value, items, onChange }: { label: string; value: string; items: string[][]; onChange(value: string): void }) {
  return <div><span className="label">{label.toUpperCase()}</span><div className="grid grid-cols-3 gap-2">{items.map(([key, text]) => <button type="button" key={key} onClick={() => onChange(key)} className={choiceClass(value === key)}>{text}</button>)}</div></div>;
}
