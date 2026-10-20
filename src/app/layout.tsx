import type { Metadata, Viewport } from "next";
// Self-hosted fonts (no build-time fetch): Inter for the UI, EB Garamond for the
// wordmark only (see components/ui/brand.tsx).
import "@fontsource-variable/inter";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-500.css";
import "@fontsource/eb-garamond/latin-600.css";
import "./globals.css";
import { OfflineBanner } from "@/components/ui/offline-banner";

export const metadata: Metadata = {
  title: { default: "Hyperpolymath", template: "%s · Hyperpolymath" },
  description: "A calm, one-screen life dashboard.",
  applicationName: "Hyperpolymath",
  // Private accounts: keep every page out of search engines.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  formatDetection: { telephone: false, email: false, address: false },
  appleWebApp: { capable: true, title: "Hyperpolymath", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#fcfcfc",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-bg text-ink">
        {children}
        <OfflineBanner />
      </body>
    </html>
  );
}
