/**
 * Rebalancing engine.
 *
 * The whole point of this file is correctness under real-world constraints, so
 * every rule is implemented explicitly and every decision is attached to the
 * action that carries it, so the UI can *show* why a lot was chosen.
 *
 * Rules implemented, in order:
 *   1. Detect drift  — flag any class whose |current - target| > 5pp.
 *   2. Recommend     — buy underweight classes, sell overweight classes back
 *                      toward target.
 *   3. Constraints   — every sell respects, per lot:
 *        • Holdings cap   — never sell more units than are held; surface the
 *          maximum sellable quantity where it binds.
 *        • Exit load      — equity-MF units held < 365d incur a 1% exit load;
 *          load-free lots are sold first when the target can still be met.
 *        • STCG / LTCG    — equities & equity MFs: >365d is LTCG, ≤365d STCG;
 *          LTCG is preferred when the target can be reached either way.
 *        • Lot-level      — exit load and gains are decided per purchase lot.
 *
 * Key simplifying decision (documented in the README): the two preferences
 * "sell load-free first" and "realise LTCG first" both point to the OLDEST lots,
 * because the 365-day line is shared. So a single ordering — oldest lot first —
 * satisfies both preferences at once, and we only ever reach a young STCG /
 * load-bearing lot when the older lots cannot cover the required redemption.
 */
import {
  currentAllocation,
  EXIT_LOAD_RATE,
  HOLDING_PERIOD_DAYS,
  holdingDays,
  holdingUnits,
  analyseAllocation,
  portfolioTotalValue,
} from "./portfolio";
import {
  type ClassAllocation,
  type GainsClassification,
  type Holding,
  type Lot,
  type LotSale,
  type Portfolio,
  type RebalanceAction,
  type RebalancePlan,
} from "./types";

const VALUE_EPSILON = 1; // ₹ — ignore residual drift smaller than a rupee

/** A lot is subject to STCG/LTCG classification if it is a direct equity or an
 *  equity mutual fund. Other asset classes are explicitly out of scope. */
function isTaxable(holding: Holding): boolean {
  return holding.assetClass === "Equities" || holding.isEquityMutualFund;
}

/** Classify a single lot's gains as of the valuation date. */
export function classifyLot(
  holding: Holding,
  lot: Lot,
  valuationDate: string,
): GainsClassification {
  if (!isTaxable(holding)) return "N/A";
  const days = holdingDays(lot.purchaseDate, valuationDate);
  return days > HOLDING_PERIOD_DAYS ? "LTCG" : "STCG";
}

/** Exit load applies only to equity-MF units held strictly less than 365 days. */
export function lotHasExitLoad(
  holding: Holding,
  lot: Lot,
  valuationDate: string,
): boolean {
  if (!holding.isEquityMutualFund) return false;
  return holdingDays(lot.purchaseDate, valuationDate) < HOLDING_PERIOD_DAYS;
}

/** Internal: a sellable lot flattened together with its parent instrument so we
 *  can pool and rank lots across every holding in a flagged class. */
interface RankedLot {
  holding: Holding;
  lot: Lot;
  price: number;
  holdingDays: number;
  classification: GainsClassification;
  exitLoad: boolean;
}

function buildRankedLots(
  holdings: Holding[],
  valuationDate: string,
): RankedLot[] {
  const ranked: RankedLot[] = [];
  for (const holding of holdings) {
    for (const lot of holding.lots) {
      ranked.push({
        holding,
        lot,
        price: holding.currentPrice,
        holdingDays: holdingDays(lot.purchaseDate, valuationDate),
        classification: classifyLot(holding, lot, valuationDate),
        exitLoad: lotHasExitLoad(holding, lot, valuationDate),
      });
    }
  }
  // Preference ordering (both preferences collapse to "oldest first"):
  //   1. load-free before load-bearing,
  //   2. LTCG before STCG,
  //   3. otherwise the older lot first (longer holding period),
  //   4. lotId for full determinism.
  return ranked.sort((a, b) => {
    if (a.exitLoad !== b.exitLoad) return a.exitLoad ? 1 : -1;
    const aLtcg = a.classification === "LTCG";
    const bLtcg = b.classification === "LTCG";
    if (aLtcg !== bLtcg) return aLtcg ? -1 : 1;
    if (b.holdingDays !== a.holdingDays) return b.holdingDays - a.holdingDays;
    return a.lot.id.localeCompare(b.lot.id);
  });
}

/** Build the SELL actions needed to remove `excessValue` from one asset class,
 *  respecting the holdings cap and recording per-lot classification / load. */
function buildSellActions(
  assetClass: RankedLot["holding"]["assetClass"],
  classHoldings: Holding[],
  excessValue: number,
  valuationDate: string,
): RebalanceAction[] {
  const ranked = buildRankedLots(classHoldings, valuationDate);
  const salesByHolding = new Map<string, LotSale[]>();
  let remaining = excessValue;

  for (const r of ranked) {
    if (remaining <= VALUE_EPSILON) break;
    const lotValue = r.lot.units * r.price;
    const takeValue = Math.min(lotValue, remaining);
    // Holdings cap is inherent: we can never take more than the lot's own units.
    const unitsToSell = takeValue / r.price;
    const redemptionValue = unitsToSell * r.price;
    const exitLoadAmount = r.exitLoad ? redemptionValue * EXIT_LOAD_RATE : 0;

    const sale: LotSale = {
      lotId: r.lot.id,
      purchaseDate: r.lot.purchaseDate,
      holdingDays: r.holdingDays,
      units: round(unitsToSell),
      redemptionValue: round(redemptionValue),
      classification: r.classification,
      exitLoad: r.exitLoad,
      exitLoadAmount: round(exitLoadAmount),
    };
    const list = salesByHolding.get(r.holding.id) ?? [];
    list.push(sale);
    salesByHolding.set(r.holding.id, list);
    remaining -= redemptionValue;
  }

  const actions: RebalanceAction[] = [];
  for (const holding of classHoldings) {
    const lotSales = salesByHolding.get(holding.id);
    if (!lotSales || lotSales.length === 0) continue;

    const units = lotSales.reduce((s, l) => s + l.units, 0);
    const estimatedValue = lotSales.reduce((s, l) => s + l.redemptionValue, 0);
    const totalExitLoad = lotSales.reduce((s, l) => s + l.exitLoadAmount, 0);
    const maxSellableUnits = holdingUnits(holding);
    const capBinds = units >= maxSellableUnits - 1e-6;

    actions.push({
      id: `sell-${holding.id}`,
      type: "SELL",
      instrumentId: holding.id,
      instrumentName: holding.instrumentName,
      assetClass,
      units: round(units),
      estimatedValue: round(estimatedValue),
      lotSales,
      maxSellableUnits: round(maxSellableUnits),
      capBinds,
      totalExitLoad: round(totalExitLoad),
      constraints: describeSellConstraints(lotSales, capBinds, maxSellableUnits, holding),
    });
  }
  return actions;
}

function describeSellConstraints(
  lotSales: LotSale[],
  capBinds: boolean,
  maxSellableUnits: number,
  holding: Holding,
): string[] {
  const tags: string[] = [];
  const ltcg = lotSales.filter((l) => l.classification === "LTCG");
  const stcg = lotSales.filter((l) => l.classification === "STCG");
  const loaded = lotSales.filter((l) => l.exitLoad);

  if (ltcg.length > 0) {
    tags.push(`Realises LTCG on ${round(sum(ltcg, (l) => l.units))} units (held > 365d)`);
  }
  if (stcg.length > 0) {
    tags.push(`Realises STCG on ${round(sum(stcg, (l) => l.units))} units (held ≤ 365d)`);
  }
  if (loaded.length > 0) {
    const loadUnits = round(sum(loaded, (l) => l.units));
    const loadAmt = round(sum(loaded, (l) => l.exitLoadAmount));
    tags.push(`⚠ Exit load 1% on ${loadUnits} units (equity MF held < 365d) ≈ ₹${loadAmt.toLocaleString("en-IN")}`);
  }
  if (capBinds) {
    tags.push(`Holdings cap: sells the entire position (max ${round(maxSellableUnits)} units)`);
  }
  if (!isTaxable(holding)) {
    tags.push("No tax / exit-load rules apply (non-equity class)");
  }
  return tags;
}

/** Build a BUY action to add `deficitValue` to an underweight class. Buys carry
 *  no tax / exit-load rules, so we simply top up the largest existing instrument
 *  in the class (or note the value if the class is currently empty). */
function buildBuyAction(
  assetClass: RankedLot["holding"]["assetClass"],
  classHoldings: Holding[],
  deficitValue: number,
): RebalanceAction | null {
  if (deficitValue <= VALUE_EPSILON) return null;
  const target = [...classHoldings].sort(
    (a, b) => holdingUnits(b) * b.currentPrice - holdingUnits(a) * a.currentPrice,
  )[0];

  if (!target) {
    return {
      id: `buy-${assetClass}`,
      type: "BUY",
      instrumentId: `new-${assetClass}`,
      instrumentName: `New ${assetClass} position`,
      assetClass,
      units: 0,
      estimatedValue: round(deficitValue),
      constraints: ["No existing instrument in this class — allocate by value"],
    };
  }

  const units = deficitValue / target.currentPrice;
  return {
    id: `buy-${target.id}`,
    type: "BUY",
    instrumentId: target.id,
    instrumentName: target.instrumentName,
    assetClass,
    units: round(units),
    estimatedValue: round(units * target.currentPrice),
    constraints: ["Buy — no exit-load / gains rules apply to purchases"],
  };
}

/** Top-level: produce the full rebalance plan for a portfolio. */
export function generateRebalancePlan(portfolio: Portfolio): RebalancePlan {
  const total = portfolioTotalValue(portfolio);
  const current = currentAllocation(portfolio);
  const allocations: ClassAllocation[] = analyseAllocation(
    current,
    portfolio.targetAllocation,
  ).map((a) => ({
    ...a,
    currentValue: round((current[a.assetClass] / 100) * total),
  }));

  const actions: RebalanceAction[] = [];
  for (const alloc of allocations) {
    if (!alloc.flagged) continue;
    const classHoldings = portfolio.holdings.filter(
      (h) => h.assetClass === alloc.assetClass,
    );
    const targetValue = (alloc.targetPct / 100) * total;
    const currentValue = (alloc.currentPct / 100) * total;

    if (alloc.status === "overweight") {
      actions.push(
        ...buildSellActions(
          alloc.assetClass,
          classHoldings,
          currentValue - targetValue,
          portfolio.valuationDate,
        ),
      );
    } else if (alloc.status === "underweight") {
      const buy = buildBuyAction(alloc.assetClass, classHoldings, targetValue - currentValue);
      if (buy) actions.push(buy);
    }
  }

  return {
    clientId: portfolio.id,
    valuationDate: portfolio.valuationDate,
    needsRebalancing: allocations.some((a) => a.flagged),
    allocations,
    actions,
  };
}

// --- small numeric helpers -------------------------------------------------

function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((s, i) => s + pick(i), 0);
}

/** Round to 4dp to keep fractional MF units sane without float noise. */
function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
