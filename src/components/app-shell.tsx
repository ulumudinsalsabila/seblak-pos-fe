"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ChevronRight,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShoppingBasket,
  Tags,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import { clsx } from "clsx";
import { useAuth } from "./auth-provider";

const nav = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    owner: true,
  },
  { href: "/pos", label: "Kasir", icon: ShoppingBasket },
  { href: "/transactions", label: "Transaksi", icon: ReceiptText },
  { href: "/products", label: "Produk", icon: Boxes, owner: true },
  { href: "/categories", label: "Kategori", icon: Tags, owner: true },
  { href: "/expenses", label: "Pengeluaran", icon: WalletCards, owner: true },
  { href: "/reports", label: "Laporan", icon: BarChart3, owner: true },
  { href: "/users", label: "Pengguna", icon: Users, owner: true },
  { href: "/settings", label: "Pengaturan", icon: Settings, owner: true },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const links = nav.filter((item) => !item.owner || user?.role === "OWNER");
  async function signOut() {
    await logout();
    router.replace("/login");
  }
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside
        className={clsx(
          "no-print fixed inset-y-0 left-0 z-40 w-[270px] bg-[#2b1c15] p-5 text-white transition-transform lg:static lg:w-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link href="/pos" className="flex items-center gap-3 font-black">
            <span className="rounded-xl bg-[#e7562c] p-2">
              <Flame size={20} />
            </span>
            <span>
              SEBLAK
              <br />
              <span className="text-orange-300">PRASMANAN</span>
            </span>
          </Link>
          <button className="lg:hidden" onClick={() => setOpen(false)}>
            <X />
          </button>
        </div>
        <nav className="space-y-1">
          {links.map((item) => {
            const Icon = item.icon;
            const active =
              path === item.href || path.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition",
                  active
                    ? "bg-[#e7562c] text-white"
                    : "text-orange-50/65 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon size={19} />
                {item.label}
                {active && <ChevronRight className="ml-auto" size={15} />}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="truncate text-sm font-bold">{user?.email}</p>
          <p className="mt-1 text-xs text-orange-200/55">{user?.role}</p>
          <button
            onClick={signOut}
            className="mt-3 flex items-center gap-2 text-xs font-bold text-orange-200 hover:text-white"
          >
            <LogOut size={14} />
            Keluar
          </button>
        </div>
      </aside>
      {open && (
        <button
          aria-label="Tutup menu"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center border-b border-[#eadfd3] bg-[#fffaf3]/90 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-xl border border-[#eadfd3] bg-white p-2"
          >
            <Menu />
          </button>
          <span className="ml-3 font-black">Seblak POS</span>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
