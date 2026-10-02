"use client";

import { createContext, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Branding } from "@/lib/types";

const fallbackBranding: Branding = { storeName: "Saung Sunja" };
const BrandingContext = createContext<Branding>(fallbackBranding);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const query = useQuery({
    queryKey: ["branding"],
    queryFn: () => api<{ data: Branding }>("/settings/branding"),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const branding = query.data?.data ?? fallbackBranding;

  useEffect(() => {
    const iconUrl = branding.faviconUrl || branding.logoUrl || "/favicon.ico";
    let link = document.querySelector<HTMLLinkElement>(
      'link[data-dynamic-favicon="true"]',
    );
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.dataset.dynamicFavicon = "true";
      document.head.appendChild(link);
    }
    link.href = iconUrl;
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
