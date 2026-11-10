"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Building2,
  ChefHat,
  ChevronsUpDown,
  Flame,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MoreHorizontal,
  PackagePlus,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Ruler,
  ReceiptText,
  ScrollText,
  Settings,
  ShoppingBasket,
  Tags,
  Users,
  WalletCards,
  Warehouse,
  MapPinned,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { OutletAccess, Role } from "@/lib/types";
import { useAuth } from "./auth-provider";
import { useBranding } from "./branding-provider";
import { SearchSelect } from "./form-controls";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};
type NavGroup = { label: string; items: NavItem[] };
type TenantNavItem = NavItem & { roles: Exclude<Role, "SUPER_ADMIN">[] };

const navGroups: Array<{ label: string; items: TenantNavItem[] }> = [
  {
    label: "Operasional",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["OWNER", "MANAGER"] },
      { href: "/pos", label: "Kasir", icon: ShoppingBasket, roles: ["OWNER", "MANAGER", "CASHIER"] },
      { href: "/kitchen", label: "Dapur", icon: ChefHat, roles: ["OWNER", "MANAGER", "KITCHEN"] },
      { href: "/transactions", label: "Transaksi", icon: ReceiptText, roles: ["OWNER", "MANAGER", "CASHIER"] },
      { href: "/expenses", label: "Pengeluaran", icon: WalletCards, roles: ["OWNER", "MANAGER"] },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/inventory", label: "Ringkasan", icon: Warehouse, exact: true, roles: ["OWNER", "MANAGER"] },
      { href: "/inventory/items", label: "Item stok", icon: PackageSearch, roles: ["OWNER", "MANAGER"] },
      { href: "/inventory/locations", label: "Lokasi stok", icon: MapPinned, roles: ["OWNER", "MANAGER"] },
      { href: "/inventory/units", label: "Satuan", icon: Ruler, roles: ["OWNER", "MANAGER"] },
      { href: "/inventory/opening-balances", label: "Saldo awal", icon: PackagePlus, roles: ["OWNER"] },
      { href: "/inventory/movements", label: "Kartu stok", icon: ScrollText, roles: ["OWNER", "MANAGER"] },
    ],
  },
  {
    label: "Master Data",
    items: [
      { href: "/products", label: "Produk", icon: Boxes, roles: ["OWNER", "MANAGER"] },
      { href: "/categories", label: "Kategori", icon: Tags, roles: ["OWNER", "MANAGER"] },
      { href: "/options", label: "Opsi Menu", icon: ListChecks, roles: ["OWNER", "MANAGER"] },
    ],
  },
  {
    label: "Laporan & Akses",
    items: [
      { href: "/reports", label: "Laporan", icon: BarChart3, roles: ["OWNER", "MANAGER"] },
      { href: "/users", label: "Pengguna", icon: Users, roles: ["OWNER"] },
      { href: "/settings", label: "Pengaturan", icon: Settings, roles: ["OWNER", "MANAGER"] },
    ],
  },
];
const superAdminNav: NavItem[] = [
  { href: "/admin", label: "Kelola outlet", icon: Building2 },
];
/** At most four quick links on the phone bottom bar; the rest live in "Lainnya". */
const bottomNavHrefs = ["/dashboard", "/pos", "/transactions", "/kitchen"];
const roleLabels: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  OWNER: "Pemilik",
  MANAGER: "Manajer",
  CASHIER: "Kasir",
  KITCHEN: "Dapur",
};

/**
 * Sidebar width on desktop (≥1024px):
 * - "auto": icon rail on 1024–1279px, full sidebar from 1280px.
 * - "collapsed" / "expanded": the user's explicit choice, kept in localStorage.
 * The POS page defaults to the rail to leave room for the cart.
 */
type SidebarMode = "auto" | "collapsed" | "expanded";
const SIDEBAR_STORAGE_KEY = "seblak-sidebar";

function readSidebarPreference(): Exclude<SidebarMode, "auto"> | null {
  try {
    const value = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    return value === "collapsed" || value === "expanded" ? value : null;
  } catch {
    return null;
  }
}

function isActive(path: string, item: NavItem) {
  return item.exact
    ? path === item.href
    : path === item.href || path.startsWith(`${item.href}/`);
}

function initials(value: string) {
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, switchOutlet } = useAuth();
  const branding = useBranding();
  const path = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // AppShell only renders on the client after auth resolves (the dashboard
  // layout shows a loader until then), so reading localStorage here cannot
  // cause a hydration mismatch.
  const [sidebarPreference, setSidebarPreference] = useState(readSidebarPreference);
  const mode: SidebarMode =
    sidebarPreference ?? (path === "/pos" ? "collapsed" : "auto");

  const groups: NavGroup[] =
    user?.role === "SUPER_ADMIN"
      ? [{ label: "Administrasi", items: superAdminNav }]
      : navGroups
          .map((group) => ({
            label: group.label,
            items: group.items.filter((item) =>
              item.roles.includes(user?.role as Exclude<Role, "SUPER_ADMIN">),
            ),
          }))
          .filter((group) => group.items.length > 0);
  const links = groups.flatMap((group) => group.items);
  const bottomLinks = links.filter((item) => bottomNavHrefs.includes(item.href));
  const showMoreButton = links.length > bottomLinks.length;
  // The POS page has its own fixed cart bar at the bottom on small screens.
  const showBottomNav = path !== "/pos" && bottomLinks.length > 0;

  const outlets = useQuery({
    queryKey: ["my-outlets", user?.id],
    queryFn: () => api<{ data: OutletAccess[] }>("/auth/outlets"),
    enabled: Boolean(user && user.role !== "SUPER_ADMIN"),
  });
  const outletOptions = (outlets.data?.data ?? []).map(({ outlet }) => ({
    value: outlet.id,
    label: outlet.name,
    description: outlet.code,
  }));

  function toggleSidebar() {
    // From "auto" the rail/full state depends on the viewport; collapsing is
    // the useful action on the common ≥1280px screens.
    const next = mode === "collapsed" ? "expanded" : "collapsed";
    setSidebarPreference(next);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the toggle still works.
    }
  }

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  const displayName = user?.name || user?.email || "";
  const roleLabel = user ? roleLabels[user.role] : "";
  const sidebarToggleLabel = mode === "collapsed" ? "Lebarkan sidebar" : "Ciutkan sidebar";

  // Label visibility per mode (the rail shows icons only).
  const labelClass =
    mode === "expanded" ? "" : mode === "collapsed" ? "lg:hidden" : "lg:hidden xl:inline";
  // In "auto" the full sidebar from 1280px already shows labels.
  const railTooltipClass = mode === "auto" ? "xl:hidden" : "";

  function brand(variant: "sidebar" | "drawer") {
    return (
      <Link
        href={links[0]?.href ?? "/"}
        onClick={() => setDrawerOpen(false)}
        className="flex min-w-0 items-center gap-3 rounded-lg font-bold text-sidebar-foreground"
      >
        <span
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-sidebar-primary bg-contain bg-center bg-no-repeat text-sidebar-primary-foreground"
          style={branding.logoUrl ? { backgroundImage: `url(${branding.logoUrl})` } : undefined}
          aria-hidden
        >
          {!branding.logoUrl && <Flame className="size-5" />}
        </span>
        <span className={cn("truncate", variant === "sidebar" && labelClass)}>
          {branding.storeName}
        </span>
      </Link>
    );
  }

  function navList(variant: "sidebar" | "drawer") {
    const rail = variant === "sidebar" && mode !== "expanded";
    return (
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.label}>
            <p
              className={cn(
                "mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground",
                rail && "lg:hidden",
                rail && mode === "auto" && "xl:block",
              )}
            >
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
          const Icon = item.icon;
          const active = isActive(path, item);
          const link = (
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={rail ? item.label : undefined}
              onClick={() => setDrawerOpen(false)}
              className={cn(
                "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                rail && "lg:justify-center lg:px-0",
                rail && mode === "auto" && "xl:justify-start xl:px-3",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden />
              <span className={cn("truncate", variant === "sidebar" && labelClass)}>
                {item.label}
              </span>
            </Link>
          );
          if (!rail) return <li key={item.href}>{link}</li>;
          return (
            <li key={item.href}>
              <Tooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className={railTooltipClass}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            </li>
          );
              })}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  function accountBlock(variant: "sidebar" | "drawer") {
    const rail = variant === "sidebar" && mode !== "expanded";
    return (
      <div className="border-t border-sidebar-border pt-3">
        <div className={cn("mb-2 min-w-0 px-1", variant === "sidebar" && labelClass)}>
          <p className="truncate text-sm font-semibold text-sidebar-foreground">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {roleLabel}
            {user?.outletName ? ` · ${user.outletName}` : ""}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          aria-label="Keluar"
          className={cn(
            "w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent",
            rail && "lg:justify-center",
            rail && mode === "auto" && "xl:justify-start",
          )}
        >
          <LogOut className="size-4" aria-hidden />
          <span className={cn(variant === "sidebar" && labelClass)}>Keluar</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar (≥1024px) */}
      <aside
        aria-label="Navigasi utama"
        className={cn(
          "no-print sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-3 transition-[width] duration-200 lg:flex",
          mode === "expanded" && "lg:w-64",
          mode === "collapsed" && "lg:w-[72px]",
          mode === "auto" && "lg:w-[72px] xl:w-64",
        )}
      >
        <div
          className={cn(
            "px-1 pt-1",
            mode !== "expanded" && "lg:flex lg:justify-center lg:px-0",
            mode === "auto" && "xl:block xl:px-1",
          )}
        >
          {brand("sidebar")}
        </div>
        <nav aria-label="Menu" className="min-h-0 flex-1 overflow-y-auto">
          {navList("sidebar")}
        </nav>
        {accountBlock("sidebar")}
      </aside>

      {/* Drawer for <1024px */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="no-print flex w-[280px] flex-col gap-6 bg-sidebar p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-[280px]"
        >
          <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
          <SheetDescription className="sr-only">
            Pilih halaman yang ingin dibuka.
          </SheetDescription>
          {brand("drawer")}
          <nav aria-label="Menu" className="min-h-0 flex-1 overflow-y-auto">
            {navList("drawer")}
          </nav>
          {accountBlock("drawer")}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex min-h-14 flex-wrap items-center gap-2 border-b border-border bg-background/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:px-5">
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-label="Buka menu"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu aria-hidden />
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:inline-flex"
                aria-label={sidebarToggleLabel}
                onClick={toggleSidebar}
              >
                {mode === "collapsed" ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{sidebarToggleLabel}</TooltipContent>
          </Tooltip>
          <span className="min-w-0 truncate font-semibold lg:hidden">{branding.storeName}</span>
          {outletOptions.length > 1 && (
            <SearchSelect
              className="order-last w-full sm:order-none sm:w-56"
              value={user?.outletId ?? ""}
              options={outletOptions}
              searchPlaceholder="Cari outlet..."
              onChange={async (outletId) => {
                await switchOutlet(outletId);
                router.replace("/dashboard");
                router.refresh();
              }}
            />
          )}
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 gap-2 px-2" aria-label="Menu akun">
                  <span
                    className="grid size-8 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                    aria-hidden
                  >
                    {initials(displayName) || "?"}
                  </span>
                  <span className="hidden min-w-0 text-left sm:block">
                    <span className="block max-w-40 truncate text-sm font-semibold">{roleLabel}</span>
                    <span className="block max-w-40 truncate text-xs font-normal text-muted-foreground">
                      {user?.outletName ?? user?.email}
                    </span>
                  </span>
                  <ChevronsUpDown className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-semibold">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {roleLabel}
                    {user?.outletName ? ` · ${user.outletName}` : ""}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut aria-hidden />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto w-full max-w-[1800px] flex-1 p-4 sm:p-6 lg:p-7",
            showBottomNav && "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6 lg:pb-7",
          )}
        >
          {children}
        </main>

        {/* Bottom navigation for phones (<768px) */}
        {showBottomNav && (
          <nav
            aria-label="Navigasi cepat"
            className="no-print fixed inset-x-0 bottom-0 z-30 flex min-h-16 border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
          >
            {bottomLinks.map((item) => {
              const Icon = item.icon;
              const active = isActive(path, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium",
                    active ? "text-primary-text" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
            {showMoreButton && (
              <button
                type="button"
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium text-muted-foreground"
                onClick={() => setDrawerOpen(true)}
                aria-haspopup="dialog"
              >
                <MoreHorizontal className="size-5" aria-hidden />
                <span>Lainnya</span>
              </button>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
