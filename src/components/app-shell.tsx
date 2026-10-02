"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  Boxes,
  ChevronRight,
  ChefHat,
  Flame,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
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
import { useBranding } from "./branding-provider";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { OutletAccess } from "@/lib/types";
import type { Role } from "@/lib/types";
import { SearchSelect } from "./form-controls";

const nav = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["OWNER", "MANAGER"],
  },
  { href: "/pos", label: "Kasir", icon: ShoppingBasket, roles: ["OWNER", "MANAGER", "CASHIER"] },
  { href: "/kitchen", label: "Dapur", icon: ChefHat, roles: ["OWNER", "MANAGER", "KITCHEN"] },
  { href: "/transactions", label: "Transaksi", icon: ReceiptText, roles: ["OWNER", "MANAGER", "CASHIER"] },
  { href: "/products", label: "Produk", icon: Boxes, roles: ["OWNER", "MANAGER"] },
  { href: "/categories", label: "Kategori", icon: Tags, roles: ["OWNER", "MANAGER"] },
  { href: "/expenses", label: "Pengeluaran", icon: WalletCards, roles: ["OWNER", "MANAGER"] },
  { href: "/reports", label: "Laporan", icon: BarChart3, roles: ["OWNER", "MANAGER"] },
  { href: "/users", label: "Pengguna", icon: Users, roles: ["OWNER"] },
  { href: "/settings", label: "Pengaturan", icon: Settings, roles: ["OWNER", "MANAGER"] },
];
const superAdminNav = [
  { href: "/admin", label: "Kelola outlet", icon: Building2 },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, switchOutlet } = useAuth();
  const branding = useBranding();
  const path = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOverride, setSidebarOverride] = useState<{
    path: string;
    expanded: boolean;
  } | null>(null);
  const sidebarExpanded =
    sidebarOverride?.path === path ? sidebarOverride.expanded : path !== "/pos";
  const links = user?.role === "SUPER_ADMIN"
    ? superAdminNav
    : nav.filter((item) => item.roles.includes(user?.role as Exclude<Role, "SUPER_ADMIN">));
  const outlets = useQuery({
    queryKey: ["my-outlets", user?.id],
    queryFn: () => api<{ data: OutletAccess[] }>("/auth/outlets"),
    enabled: Boolean(user && user.role !== "SUPER_ADMIN"),
  });
  async function signOut() {
    await logout();
    router.replace("/login");
  }
  return (
    <div
      className={clsx(
        "min-h-screen lg:grid",
        sidebarExpanded
          ? "lg:grid-cols-[250px_1fr]"
          : "lg:grid-cols-[88px_1fr]",
      )}
    >
      <aside
        className={clsx(
          "no-print fixed inset-y-0 left-0 z-40 w-[270px] bg-[#2b1c15] p-5 text-white transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          sidebarExpanded ? "lg:p-5" : "lg:p-4",
        )}
      >
        <div
          className={clsx(
            "mb-8 flex items-center",
            sidebarExpanded ? "justify-between" : "lg:justify-center",
          )}
        >
          <Link href="/pos" className="flex items-center gap-3 font-black">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--brand)] bg-contain bg-center bg-no-repeat text-white"
              style={
                branding.logoUrl
                  ? { backgroundImage: `url(${branding.logoUrl})` }
                  : undefined
              }
            >
              {!branding.logoUrl && <Flame size={20} />}
            </span>
            <span className={clsx(!sidebarExpanded && "lg:hidden")}>
              {branding.storeName}
            </span>
          </Link>
          <button className="lg:hidden" onClick={() => setMobileOpen(false)}>
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
                title={!sidebarExpanded ? item.label : undefined}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition",
                  !sidebarExpanded && "lg:justify-center lg:px-2",
                  active
                    ? "bg-[var(--brand)] text-white"
                    : "text-orange-50/65 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon size={19} />
                <span className={clsx(!sidebarExpanded && "lg:hidden")}>
                  {item.label}
                </span>
                {active && sidebarExpanded && (
                  <ChevronRight className="ml-auto" size={15} />
                )}
              </Link>
            );
          })}
        </nav>
        <div
          className={clsx(
            "absolute bottom-5 rounded-xl border border-white/10 bg-white/5 p-3",
            sidebarExpanded ? "left-5 right-5" : "left-4 right-4 lg:px-2",
          )}
        >
          <div className={clsx(!sidebarExpanded && "lg:hidden")}>
            <p className="truncate text-sm font-bold">{user?.email}</p>
            <p className="mt-1 text-xs text-orange-200/55">{user?.role}</p>
          </div>
          <button
            onClick={signOut}
            title="Keluar"
            className={clsx(
              "flex items-center gap-2 text-xs font-bold text-orange-200 hover:text-white",
              sidebarExpanded ? "mt-3" : "lg:mx-auto",
            )}
          >
            <LogOut size={14} />
            <span className={clsx(!sidebarExpanded && "lg:hidden")}>
              Keluar
            </span>
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button
          aria-label="Tutup menu"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <div className="min-w-0">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center border-b border-[#eadfd3] bg-[#fffaf3]/90 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-xl border border-[#eadfd3] bg-white p-2 lg:hidden"
          >
            <Menu />
          </button>
          <button
            onClick={() =>
              setSidebarOverride({ path, expanded: !sidebarExpanded })
            }
            className="hidden rounded-xl border border-[#eadfd3] bg-white p-2 lg:block"
            title={sidebarExpanded ? "Tutup sidebar" : "Buka sidebar"}
          >
            {sidebarExpanded ? <PanelLeftClose /> : <PanelLeftOpen />}
          </button>
          <span className="ml-3 font-black">{branding.storeName} POS</span>
          {(outlets.data?.data.length ?? 0) > 1 && (
            <SearchSelect
              className="ml-3 hidden w-52 sm:block"
              value={user?.outletId ?? ""}
              options={(outlets.data?.data ?? []).map(({ outlet }) => ({
                value: outlet.id,
                label: outlet.name,
                description: outlet.code,
              }))}
              searchPlaceholder="Cari outlet..."
              onChange={async (outletId) => {
                await switchOutlet(outletId);
                router.replace("/dashboard");
                router.refresh();
              }}
            />
          )}
          <div className="ml-auto text-right">
            <p className="text-sm font-black">
              {user?.role.replaceAll("_", " ")}
            </p>
            <p className="hidden text-xs text-[#796c63] sm:block">
              {user?.outletName ?? user?.email}
            </p>
          </div>
        </header>
        <main className="mx-auto max-w-[1800px] p-4 sm:p-6 lg:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
