/**
 * Client-side overlay so rebalances survive reloads without a real backend.
 * The mock server keeps state in memory only, which is wiped on every
 * restart/hot-reload — we persist the last-applied portfolio per client in
 * localStorage and merge it back in over whatever the server returns.
 */
import type { Portfolio } from "./types";

const KEY_PREFIX = "portfolio-pulse:";

export function loadOverride(id: string): Portfolio | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY_PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Portfolio;
  } catch {
    return null;
  }
}

export function saveOverride(portfolio: Portfolio): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_PREFIX + portfolio.id, JSON.stringify(portfolio));
}
