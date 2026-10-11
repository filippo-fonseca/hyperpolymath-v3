import type { Metadata, Viewport } from "next";
// Self-hosted fonts (no build-time fetch): Inter for the UI, EB Garamond for the
// wordmark only (see components/ui/brand.tsx).
import "@fontsource-variable/inter";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-500.css";
import "@fontsource/eb-garamond/latin-600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hyperpolymath",
  description: "A calm, one-screen life dashboard.",
  appleWebApp: { capable: true, title: "Hyperpolymath", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#fcfcfc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-bg text-ink">{children}</body>
    </html>
  );
}
