"use client";

import { createContext, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Branding } from "@/lib/types";

const fallbackBranding: Branding = { storeName: "Saung Sunja" };
const BrandingContext = createContext<Branding>(fallbackBranding);

function versionedIconUrl(url: string) {
  let hash = 0;
  for (let index = 0; index < url.length; index += 1) {
    hash = (hash * 31 + url.charCodeAt(index)) | 0;
  }
  return `${url}${url.includes("?") ? "&" : "?"}brand=${Math.abs(hash)}`;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const query = useQuery({
    queryKey: ["branding"],
    queryFn: () => api<{ data: Branding }>("/settings/branding"),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const branding = query.data?.data ?? fallbackBranding;

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

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
