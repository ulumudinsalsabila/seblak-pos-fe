"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Branding, TenantTheme } from "@/lib/types";
import { useAuth } from "./auth-provider";

const fallbackBranding: Branding = {
  storeName: "DagoraApp",
  logoUrl: "/dagoraapp-logo.png",
  faviconUrl: "/dagoraapp-favicon.png",
  primaryColor: "#C2410C",
};

const BrandingContext = createContext<Branding>(fallbackBranding);

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const DARK_TEXT = "#0F172A";

export function isHexColor(value: string | null | undefined): value is string {
  return Boolean(value && HEX_COLOR.test(value));
}

function rgb(color: string) {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance(color: string) {
  const [red, green, blue] = rgb(color).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

/** WCAG contrast ratio between two `#RRGGBB` colours. */
export function contrastRatio(a: string, b: string) {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (light + 0.05) / (dark + 0.05);
}

/** White or dark text, whichever has the higher contrast on `color`. */
export function readableForeground(color: string) {
  return contrastRatio(color, "#FFFFFF") >= contrastRatio(color, DARK_TEXT)
    ? "#FFFFFF"
    : DARK_TEXT;
}

function versionedIconUrl(url: string) {
  let hash = 0;
  for (let index = 0; index < url.length; index += 1) {
    hash = (hash * 31 + url.charCodeAt(index)) | 0;
  }
  return `${url}${url.includes("?") ? "&" : "?"}brand=${Math.abs(hash)}`;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: ["tenant-theme", user?.tenantId],
    queryFn: () => api<{ data: TenantTheme }>("/settings/theme"),
    enabled: !loading && Boolean(user?.tenantId),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  // Errors fall through to the defaults: branding must never block the app.
  const theme = user?.tenantId ? query.data?.data : undefined;
  const storeName = theme?.tenantName ?? fallbackBranding.storeName;
  const logoUrl = theme?.logoUrl || fallbackBranding.logoUrl;
  const faviconUrl =
    theme?.faviconUrl || theme?.logoUrl || fallbackBranding.faviconUrl;
  const primaryColor = isHexColor(theme?.primaryColor)
    ? theme.primaryColor
    : fallbackBranding.primaryColor;
  const tenantId = theme?.tenantId;
  const tenantName = theme?.tenantName;
  const tenantSlug = theme?.tenantSlug;

  useEffect(() => {
    const sourceUrl = faviconUrl || logoUrl || "/favicon.ico";
    const iconUrl = versionedIconUrl(sourceUrl);
    function applyIcons() {
      const links = Array.from(
        document.querySelectorAll<HTMLLinkElement>(
          'link[rel~="icon"], link[rel="apple-touch-icon"]',
        ),
      );
      if (!links.length) {
        const icon = document.createElement("link");
        icon.rel = "icon";
        document.head.appendChild(icon);
        links.push(icon);
      }
      for (const link of links) {
        link.href = iconUrl;
        link.removeAttribute("type");
        link.removeAttribute("sizes");
      }
    }
    applyIcons();
    const observer = new MutationObserver(applyIcons);
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, [faviconUrl, logoUrl]);

  useEffect(() => {
    const [red, green, blue] = rgb(primaryColor);
    const darken = (channel: number) => Math.max(0, Math.round(channel * 0.78));
    const dark = `#${[darken(red), darken(green), darken(blue)]
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`;
    const root = document.documentElement;
    root.style.setProperty("--brand", primaryColor);
    root.style.setProperty("--brand-dark", dark);
    root.style.setProperty("--brand-rgb", `${red}, ${green}, ${blue}`);
    root.style.setProperty("--primary", primaryColor);
    root.style.setProperty(
      "--primary-foreground",
      readableForeground(primaryColor),
    );
    // Dark mode is deferred until every page uses tokens; clear any class a
    // previous build may have left behind.
    root.classList.remove("dark");
    document.title = `${storeName} · DagoraApp`;
  }, [primaryColor, storeName]);

  const context = useMemo<Branding>(
    () => ({
      storeName,
      logoUrl,
      faviconUrl,
      primaryColor,
      tenantId,
      tenantName,
      tenantSlug,
    }),
    [storeName, logoUrl, faviconUrl, primaryColor, tenantId, tenantName, tenantSlug],
  );

  return (
    <BrandingContext.Provider value={context}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
