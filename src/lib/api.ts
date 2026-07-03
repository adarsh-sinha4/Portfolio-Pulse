/** Thin client-side API layer. Components never import mock data directly — all
 *  data flows through these fetchers, so the boundary matches a real backend. */
import type {
  ClientSummary,
  PerformanceSeries,
  Portfolio,
  RebalanceAction,
} from "./types";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Request failed (${res.status}): ${msg}`);
  }
  return res.json() as Promise<T>;
}

export function fetchClients(): Promise<{ clients: ClientSummary[] }> {
  return getJSON("/api/clients");
}

export function fetchPortfolio(id: string): Promise<{ portfolio: Portfolio }> {
  return getJSON(`/api/clients/${id}/portfolio`);
}

export function fetchPerformance(id: string): Promise<{ performance: PerformanceSeries }> {
  return getJSON(`/api/clients/${id}/performance`);
}

export async function applyRebalance(
  id: string,
  actions: RebalanceAction[],
): Promise<{ portfolio: Portfolio }> {
  const res = await fetch(`/api/clients/${id}/rebalance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actions }),
  });
  if (!res.ok) throw new Error(`Rebalance failed (${res.status})`);
  return res.json();
}

export async function resetPortfolio(id: string): Promise<{ portfolio: Portfolio }> {
  const res = await fetch(`/api/clients/${id}/rebalance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reset: true }),
  });
  if (!res.ok) throw new Error(`Reset failed (${res.status})`);
  return res.json();
}
