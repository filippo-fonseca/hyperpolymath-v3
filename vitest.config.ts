import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Integration tests read Supabase credentials from .env.local when present.
try {
  process.loadEnvFile(".env.local");
} catch {}

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside React Server Components; tests are server code.
      "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
