/**
 * In-memory server store. The mock backend needs somewhere to hold state so an
 * "Apply rebalance" POST is actually reflected by subsequent GETs. A module-level
 * mutable clone of the dataset is sufficient for a single-process dev server and
 * keeps the API honest: applying actions really does move the allocation.
 */
import { dataset } from "./data";
import { holdingUnits } from "./portfolio";
import type { Holding, Portfolio, RebalanceAction } from "./types";

// Deep clone so mutations never leak back into the authored dataset.
const state = new Map<string, Portfolio>(
  dataset.clients.map((c) => [c.id, structuredClone(c)]),
);

export function listPortfolios(): Portfolio[] {
  return [...state.values()];
}

export function getPortfolio(id: string): Portfolio | undefined {
  return state.get(id);
}

/** Apply proposed buy/sell actions to the stored portfolio and return the
 *  updated snapshot. Sells reduce lots oldest-first (matching how the engine
 *  chose them); buys append a new lot at the current price on the valuation
 *  date. Buys and sells are independent — we do not model a cash account. */
export function applyRebalance(id: string, actions: RebalanceAction[]): Portfolio | undefined {
  const portfolio = state.get(id);
  if (!portfolio) return undefined;

  for (const action of actions) {
    const holding = portfolio.holdings.find((h) => h.id === action.instrumentId);

    if (action.type === "SELL") {
      if (!holding) continue;
      reduceUnits(holding, action.units);
    } else {
      if (holding) {
        holding.lots.push({
          id: `${holding.id}-lot-buy-${Date.now()}`,
          purchaseDate: portfolio.valuationDate,
          units: action.units,
          buyPrice: holding.currentPrice,
        });
      }
      // A synthetic "new class" buy with no instrument is ignored in this mock.
    }
  }

  // Recompute AUM from the mutated holdings so the summary stays consistent.
  portfolio.aum = Math.round(
    portfolio.holdings.reduce((s, h) => s + holdingUnits(h) * h.currentPrice, 0),
  );
  return portfolio;
}

/** Reset a single portfolio back to its authored state (used by the UI's
 *  "reset" affordance so the demo is repeatable). */
export function resetPortfolio(id: string): Portfolio | undefined {
  const original = dataset.clients.find((c) => c.id === id);
  if (!original) return undefined;
  const fresh = structuredClone(original);
  state.set(id, fresh);
  return fresh;
}

function reduceUnits(holding: Holding, units: number): void {
  let remaining = units;
  const lots = [...holding.lots].sort(
    (a, b) => Date.parse(a.purchaseDate) - Date.parse(b.purchaseDate),
  );
  for (const lot of lots) {
    if (remaining <= 1e-9) break;
    const take = Math.min(lot.units, remaining);
    lot.units = round4(lot.units - take);
    remaining -= take;
  }
  holding.lots = holding.lots.filter((l) => l.units > 1e-6);
}

function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
