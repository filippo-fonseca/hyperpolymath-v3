"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

let client: SupabaseClient<Database> | null = null;

/**
 * Browser client that shares the session cookies set by the server. Used for
 * Realtime only; the browser never writes to the database directly.
 * Url and key are passed in from the server so they are read at runtime.
 */
export function supabaseBrowser(url: string, key: string): SupabaseClient<Database> {
  if (!client) client = createBrowserClient<Database>(url, key);
  return client;
}
