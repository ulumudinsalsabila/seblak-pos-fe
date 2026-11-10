"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./auth-provider";
import { BrandingProvider } from "./branding-provider";
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <BrandingProvider>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="top-center" richColors closeButton />
          </TooltipProvider>
        </BrandingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
