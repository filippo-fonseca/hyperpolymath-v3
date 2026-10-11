"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

const TABLES = ["tasks", "habit_logs", "habits", "captures", "widgets", "bots", "actions", "reminders", "routines", "routine_runs", "areas", "projects"] as const;
const DEBOUNCE_MS = 250;

/**
 * Listens for row changes (from Kiwi over MCP, or another device) and
 * refreshes the server-rendered data, debounced so a burst is one refresh.
 */
export function RealtimeRefresh({ userId, url, anonKey }: { userId: string; url: string; anonKey: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = supabaseBrowser(url, anonKey);
    let timer: number | undefined;
    let cancelled = false;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), DEBOUNCE_MS);
    };

    const channel = supabase.channel(`dashboard:${userId}`);
    for (const table of TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` }, refresh);
    }

    void (async () => {
      // Realtime enforces RLS with the signed-in user's token.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel.subscribe();
    })();

    // Catch up after the tab was hidden or the device slept.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [router, userId, url, anonKey]);

  return null;
}
