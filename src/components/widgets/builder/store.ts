"use client";

import { useSyncExternalStore } from "react";

// Opens the widget builder from anywhere (edit mode, an expanded widget, the
// command palette) without threading callbacks through the dashboard.

export type BuilderRequest = { widgetId?: string; mode?: "live" | "write" | "ask"; key: number };

let current: BuilderRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openBuilder(opts: { widgetId?: string; mode?: BuilderRequest["mode"] } = {}) {
  current = { ...opts, key: Date.now() };
  emit();
}

export function closeBuilder() {
  current = null;
  emit();
}

export function useBuilderRequest() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
