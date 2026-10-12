"use client";

// Replaces the root layout when it fails, so it brings its own document,
// fonts and styles.
import "@fontsource-variable/inter";
import "@fontsource/eb-garamond/latin-500.css";
import "./globals.css";
import { ErrorScreen } from "@/components/ui/error-screen";

export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <title>Something went wrong · Hyperpolymath</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="min-h-full bg-bg text-ink">
        <ErrorScreen error={error} retry={retry} />
      </body>
    </html>
  );
}
