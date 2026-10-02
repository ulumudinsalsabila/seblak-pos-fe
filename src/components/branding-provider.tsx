"use client";

import { createContext, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Branding } from "@/lib/types";
import { useAuth } from "./auth-provider";

const fallbackBranding: Branding = {
  storeName: "DagoraApp",
  logoUrl: "/dagoraapp-logo.png",
  faviconUrl: "/dagoraapp-favicon.png",
  primaryColor: "#0B63F6",
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
    queryKey: ["branding", user?.outletId],
    queryFn: () => api<{ data: Branding }>("/settings"),
    enabled: !loading && Boolean(user?.outletId),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const merchantBranding = query.data?.data;
  const branding: Branding = {
    storeName: merchantBranding?.storeName ?? fallbackBranding.storeName,
    logoUrl: merchantBranding?.logoUrl || fallbackBranding.logoUrl,
    faviconUrl:
      merchantBranding?.faviconUrl ||
      merchantBranding?.logoUrl ||
      fallbackBranding.faviconUrl,
    primaryColor:
      merchantBranding?.primaryColor ?? fallbackBranding.primaryColor,
  };

  useEffect(() => {
    const sourceUrl = branding.faviconUrl || branding.logoUrl || "/favicon.ico";
    const iconUrl = versionedIconUrl(sourceUrl);
    function applyIcons() {
      const iconLinks = Array.from(
        document.querySelectorAll<HTMLLinkElement>(
          'link[rel~="icon"], link[rel="apple-touch-icon"]',
        ),
      );

      if (!iconLinks.length) {
        const icon = document.createElement("link");
        icon.rel = "icon";
        document.head.appendChild(icon);
        iconLinks.push(icon);
      }

      for (const link of iconLinks) {
        link.href = iconUrl;
        link.removeAttribute("type");
        link.removeAttribute("sizes");
        link.dataset.dynamicBranding = "true";
      }

      if (!document.querySelector('link[rel="apple-touch-icon"]')) {
        const touchIcon = document.createElement("link");
        touchIcon.rel = "apple-touch-icon";
        touchIcon.href = iconUrl;
        touchIcon.dataset.dynamicBranding = "true";
        document.head.appendChild(touchIcon);
      }
    }

    applyIcons();
    const observer = new MutationObserver(applyIcons);
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, [branding.faviconUrl, branding.logoUrl]);

  useEffect(() => {
    const color = branding.primaryColor;
    const value = Number.parseInt(color.slice(1), 16);
    const darken = (channel: number) => Math.max(0, Math.round(channel * 0.78));
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    const dark = `#${[darken(red), darken(green), darken(blue)]
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`;
    document.documentElement.style.setProperty("--brand", color);
    document.documentElement.style.setProperty("--brand-dark", dark);
    document.documentElement.style.setProperty("--brand-rgb", `${red}, ${green}, ${blue}`);
    document.title = `${branding.storeName} · DagoraApp`;
  }, [branding.primaryColor, branding.storeName]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
