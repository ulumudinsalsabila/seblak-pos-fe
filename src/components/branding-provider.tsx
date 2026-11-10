"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  applyBrandVars,
  brandVars,
  clearBrandVars,
  DEFAULT_PRIMARY,
  isHexColor,
  THEME_STORAGE_KEY,
} from "@/lib/theme";
import type { Branding, TenantTheme } from "@/lib/types";
import { useAuth } from "./auth-provider";

export { contrastRatio, isHexColor, readableForeground } from "@/lib/theme";

const fallbackBranding: Branding = {
  storeName: "DagoraApp",
  logoUrl: "/dagoraapp-logo.png",
  faviconUrl: "/dagoraapp-favicon.png",
  primaryColor: DEFAULT_PRIMARY,
};

const BrandingContext = createContext<Branding>(fallbackBranding);

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
  const signedOut = !loading && !user;

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
    const root = document.documentElement;
    // Dark mode is deferred until every page uses tokens; clear any class a
    // previous build may have left behind.
    root.classList.remove("dark");
    if (signedOut) {
      // No previous tenant's colours may survive a logout or expired session.
      localStorage.removeItem(THEME_STORAGE_KEY);
      clearBrandVars();
    } else if (tenantId) {
      const vars = brandVars(primaryColor);
      applyBrandVars(vars);
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ tenantId, vars }));
    }
    // While auth or the theme is still loading, keep whatever the boot script
    // applied so the colour does not flash.
  }, [signedOut, tenantId, primaryColor]);

  useEffect(() => {
    document.title = `${storeName} · DagoraApp`;
  }, [storeName]);

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
