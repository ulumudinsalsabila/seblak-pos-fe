import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "DagoraApp",
  description: "Platform kasir multi-outlet DagoraApp",
  icons: {
    icon: "/dagoraapp-favicon.png",
    apple: "/dagoraapp-favicon.png",
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
