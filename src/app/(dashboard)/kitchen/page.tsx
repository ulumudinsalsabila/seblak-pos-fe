"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChefHat,
  Clock3,
  Flame,
  LoaderCircle,
  Package,
  RefreshCw,
  Store,
  UserRound,
} from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/api";
import type { Transaction } from "@/lib/types";
import { Empty, ErrorNotice } from "@/components/ui";

type KitchenResponse = { data: Transaction[]; meta: null };
type Tab = "PENDING" | "COMPLETED";
const EMPTY_ORDERS: Transaction[] = [];

const brothLabels = { LITTLE: "Sedikit", MEDIUM: "Sedang", MUCH: "Banyak" };
const tasteLabels = { SALTY: "Asin", SAVORY: "Gurih", SWEET: "Manis" };

function elapsedLabel(value: string, now: number) {
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 60_000),
  );
  if (minutes < 1) return "Baru masuk";
  if (minutes < 60) return `${minutes} menit`;
  return `${Math.floor(minutes / 60)}j ${minutes % 60}m`;
}

function shortTime(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function playBell() {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.setValueAtTime(0.001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.24, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.7);
  [660, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(context.currentTime + index * 0.16);
    oscillator.stop(context.currentTime + 0.35 + index * 0.16);
  });
  window.setTimeout(() => void context.close(), 1000);
}

export default function KitchenPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("PENDING");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [actionError, setActionError] = useState<unknown>(null);
  const [now, setNow] = useState(() => Date.now());
  const seenIds = useRef<Set<string> | null>(null);

  const pendingQuery = useQuery({
    queryKey: ["kitchen", "PENDING"],
    queryFn: () => api<KitchenResponse>("/transactions/kitchen?status=PENDING"),
    refetchInterval: 5_000,
    staleTime: 0,
  });
  const completedQuery = useQuery({
    queryKey: ["kitchen", "COMPLETED"],
    queryFn: () =>
      api<KitchenResponse>("/transactions/kitchen?status=COMPLETED"),
    enabled: tab === "COMPLETED",
    refetchInterval: tab === "COMPLETED" ? 10_000 : false,
    staleTime: 0,
  });

  const pendingOrders = pendingQuery.data?.data ?? EMPTY_ORDERS;
  const activeQuery = tab === "PENDING" ? pendingQuery : completedQuery;
  const orders = activeQuery.data?.data ?? EMPTY_ORDERS;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const currentIds = new Set(pendingOrders.map((order) => order.id));
    const newOrders = seenIds.current
      ? pendingOrders.filter((order) => !seenIds.current?.has(order.id))
      : [];
    if (newOrders.length) {
      if (soundEnabled) playBell();
      if (
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Pesanan baru masuk", {
          body: `${newOrders.at(-1)?.customerName ?? "Pelanggan"} • ${newOrders.at(-1)?.items.length ?? 0} item`,
        });
      }
    }
    seenIds.current = currentIds;
  }, [pendingOrders, soundEnabled]);

  useEffect(() => {
    document.title = pendingOrders.length
      ? `(${pendingOrders.length}) Antrian Dapur • Saung Sunja`
      : "Dapur • Saung Sunja";
    return () => {
      document.title = "Saung Sunja POS";
    };
  }, [pendingOrders.length]);

  async function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next) {
      playBell();
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    }
  }

  async function complete(orderId: string, itemId?: string) {
    const key = itemId ?? orderId;
    setBusyKey(key);
    setActionError(null);
    try {
      const path = itemId
        ? `/transactions/kitchen/${orderId}/items/${itemId}/complete`
        : `/transactions/kitchen/${orderId}/complete`;
      await api(path, { method: "POST" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["kitchen", "PENDING"] }),
        queryClient.invalidateQueries({ queryKey: ["kitchen", "COMPLETED"] }),
      ]);
    } catch (error) {
      setActionError(error);
    } finally {
      setBusyKey("");
    }
  }

  return (
    <div className="min-h-[calc(100vh-7.5rem)]">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-[#2b1c15] p-3 text-indigo-300 shadow-lg">
            <ChefHat size={28} />
          </span>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Layar Dapur</h1>
            <p className="mt-1 text-sm text-[#796c63]">
              Pesanan diperbarui otomatis setiap 5 detik.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            className={clsx(
              "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition",
              soundEnabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-[#eadfd3] bg-white text-[#796c63]",
            )}
          >
            {soundEnabled ? <Bell size={17} /> : <BellOff size={17} />}
            {soundEnabled ? "Suara aktif" : "Aktifkan suara"}
          </button>
          <button
            type="button"
            aria-label="Muat ulang"
            title="Muat ulang"
            onClick={() => void activeQuery.refetch()}
            className="rounded-xl border border-[#eadfd3] bg-white p-2.5 text-[#796c63]"
          >
            <RefreshCw
              size={19}
              className={activeQuery.isFetching ? "animate-spin" : ""}
            />
          </button>
        </div>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3 sm:max-w-xl">
        <button
          type="button"
          onClick={() => setTab("PENDING")}
          className={clsx(
            "rounded-2xl border p-4 text-left transition",
            tab === "PENDING"
              ? "border-[#e7562c] bg-[#e7562c] text-white shadow-lg shadow-indigo-900/10"
              : "border-[#eadfd3] bg-white",
          )}
        >
          <span className="text-xs font-black uppercase tracking-widest opacity-75">
            Antrian aktif
          </span>
          <span className="mt-1 block text-3xl font-black">
            {pendingOrders.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("COMPLETED")}
          className={clsx(
            "rounded-2xl border p-4 text-left transition",
            tab === "COMPLETED"
              ? "border-[#477a52] bg-[#477a52] text-white shadow-lg shadow-green-900/10"
              : "border-[#eadfd3] bg-white",
          )}
        >
          <span className="text-xs font-black uppercase tracking-widest opacity-75">
            Selesai hari ini
          </span>
          <span className="mt-1 block text-lg font-black">Lihat riwayat</span>
        </button>
      </section>

      {actionError !== null && (
        <div className="mb-4">
          <ErrorNotice error={actionError} />
        </div>
      )}
      {activeQuery.error && (
        <div className="mb-4">
          <ErrorNotice error={activeQuery.error} />
        </div>
      )}

      {activeQuery.isLoading ? (
        <div className="flex min-h-64 items-center justify-center gap-2 text-[#796c63]">
          <LoaderCircle className="animate-spin" /> Menyiapkan layar dapur...
        </div>
      ) : orders.length ? (
        <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {orders.map((order, orderIndex) => {
            const minutes = Math.max(
              0,
              Math.floor((now - new Date(order.createdAt).getTime()) / 60_000),
            );
            const isNew = tab === "PENDING" && minutes < 2;
            const pendingItems = order.items.filter(
              (item) => item.kitchenStatus === "PENDING",
            ).length;
            return (
              <article
                key={order.id}
                className={clsx(
                  "overflow-hidden rounded-2xl border bg-white shadow-[0_12px_30px_rgba(75,47,31,.07)]",
                  isNew
                    ? "border-[#e7562c] ring-2 ring-indigo-100"
                    : "border-[#eadfd3]",
                )}
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#eee3d9] bg-[#fff9f2] p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx(
                        "grid h-11 w-11 place-items-center rounded-xl text-lg font-black",
                        tab === "PENDING"
                          ? "bg-[#2b1c15] text-white"
                          : "bg-emerald-100 text-emerald-700",
                      )}
                    >
                      {tab === "PENDING" ? (
                        orderIndex + 1
                      ) : (
                        <CheckCheck size={22} />
                      )}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-black">{order.customerName}</h2>
                        {isNew && (
                          <span className="badge bg-[#e7562c] text-white">
                            BARU
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-bold text-[#796c63]">
                        {order.invoiceNo}
                      </p>
                    </div>
                  </div>
                  <span
                    className={clsx(
                      "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black",
                      tab === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-700"
                        : minutes >= 20
                          ? "bg-red-100 text-red-700"
                          : minutes >= 10
                            ? "bg-amber-100 text-amber-700"
                            : "bg-indigo-100 text-indigo-700",
                    )}
                  >
                    <Clock3 size={13} />
                    {tab === "PENDING"
                      ? elapsedLabel(order.createdAt, now)
                      : shortTime(order.kitchenCompletedAt)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-[#f1e8df] px-4 py-3 text-xs font-bold text-[#65584f]">
                  <span className="flex items-center gap-1.5">
                    {order.orderType === "DINE_IN" ? (
                      <Store size={15} />
                    ) : (
                      <Package size={15} />
                    )}
                    {order.orderType === "DINE_IN"
                      ? "Makan di tempat"
                      : "Bungkus"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <UserRound size={15} />
                    {order.cashier.name}
                  </span>
                </div>

                <div className="space-y-2 p-4">
                  {order.items.map((item) => {
                    const done = item.kitchenStatus === "COMPLETED";
                    const itemBusy = busyKey === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        disabled={
                          done || Boolean(busyKey) || tab === "COMPLETED"
                        }
                        onClick={() => void complete(order.id, item.id)}
                        className={clsx(
                          "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                          done
                            ? "border-emerald-100 bg-emerald-50/70 text-[#78857a]"
                            : "border-[#eadfd3] bg-white hover:border-emerald-400 hover:bg-emerald-50",
                        )}
                      >
                        <span
                          className={clsx(
                            "grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2",
                            done
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-[#d5c6b9] bg-white",
                          )}
                        >
                          {itemBusy ? (
                            <LoaderCircle size={16} className="animate-spin" />
                          ) : done ? (
                            <Check size={17} strokeWidth={3} />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={clsx(
                              "block font-black",
                              done && "line-through",
                            )}
                          >
                            {item.productName}
                          </span>
                          <span className="mt-0.5 block text-xs text-[#8a7a6f]">
                            {item.selectedOptions?.length
                              ? item.selectedOptions.map((option) => `${option.groupName}: ${option.valueLabel}`).join(" · ")
                              : `Rasa: ${tasteLabels[item.tastePreference]} · Pedas ${item.spicyLevel} · Kuah: ${brothLabels[item.brothLevel]}`}
                          </span>
                        </span>
                        <strong className="rounded-lg bg-[#2b1c15] px-2.5 py-1.5 text-white">
                          ×{item.quantity}
                        </strong>
                      </button>
                    );
                  })}
                </div>

                {(!order.items.some((item) => item.selectedOptions?.length) || order.notes) && <div className="mx-4 mb-4 rounded-xl bg-[#fff3e7] p-3 text-sm">
                  {!order.items.some((item) => item.selectedOptions?.length) && <div className="flex flex-wrap gap-x-4 gap-y-2 font-bold text-[#6d4633]">
                    <span className="flex items-center gap-1">
                      <Flame size={15} className="text-[#e7562c]" />
                      Pedas {order.spicyLevel}
                    </span>
                    <span>Kuah: {brothLabels[order.brothLevel]}</span>
                    <span>Rasa: {tasteLabels[order.tastePreference]}</span>
                  </div>}
                  {order.notes && (
                    <p className="mt-2 border-t border-indigo-200 pt-2 font-black text-indigo-700">
                      Catatan: {order.notes}
                    </p>
                  )}
                </div>}

                {tab === "PENDING" && (
                  <div className="border-t border-[#eee3d9] p-4">
                    <button
                      type="button"
                      disabled={Boolean(busyKey)}
                      onClick={() => void complete(order.id)}
                      className="btn-primary flex w-full items-center justify-center gap-2 py-3"
                    >
                      {busyKey === order.id ? (
                        <LoaderCircle size={18} className="animate-spin" />
                      ) : (
                        <CheckCheck size={19} />
                      )}
                      Selesaikan Semua{" "}
                      {pendingItems < order.items.length
                        ? `(${pendingItems} tersisa)`
                        : ""}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <Empty>
          <ChefHat className="mx-auto mb-3 text-[#cbbbad]" size={44} />
          <p className="font-black text-[#241c17]">
            {tab === "PENDING"
              ? "Semua pesanan sudah beres!"
              : "Belum ada pesanan selesai hari ini."}
          </p>
          <p className="mt-1 text-sm">
            {tab === "PENDING"
              ? "Pesanan baru akan muncul otomatis di sini."
              : "Riwayat selesai akan tampil di sini."}
          </p>
        </Empty>
      )}
    </div>
  );
}
