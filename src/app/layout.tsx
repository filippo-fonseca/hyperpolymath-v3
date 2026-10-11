import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg text-ink">{children}</body>
    </html>
  );
}
