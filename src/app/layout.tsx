import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { themeBootScript } from "@/lib/theme";

// Plus Jakarta Sans: designed for Jakarta, reads well for Indonesian copy and
// has clear, even numerals for prices and KPIs.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

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
    // The boot script sets the last tenant's brand colours on <html> before
    // hydration, so the style attribute legitimately differs from the server.
    <html lang="id" className={jakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
