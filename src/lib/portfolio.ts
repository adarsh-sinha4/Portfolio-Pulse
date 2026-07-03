/**
 * Pure derivation helpers. Everything an RM sees that can be computed from raw
 * holding data (units, price, cost basis) is derived here — the API never hands
 * us current value, weights, or current allocation.
 */
import {
  ASSET_CLASSES,
  type AssetClass,
  type ClassAllocation,
  type DerivedHolding,
  type Holding,
  type Portfolio,
  type TargetAllocation,
} from "./types";

/** A class is flagged when it drifts more than this many absolute pp. */
export const DRIFT_THRESHOLD_PP = 5;

/** The single 365-day line used for BOTH exit load and STCG/LTCG. */
export const HOLDING_PERIOD_DAYS = 365;

/** Exit load rate on equity-MF units redeemed inside the holding-period window. */
export const EXIT_LOAD_RATE = 0.01;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function holdingUnits(holding: Holding): number {
  return holding.lots.reduce((sum, lot) => sum + lot.units, 0);
}

export function holdingCostBasis(holding: Holding): number {
  return holding.lots.reduce((sum, lot) => sum + lot.units * lot.buyPrice, 0);
}

export function holdingCurrentValue(holding: Holding): number {
  return holdingUnits(holding) * holding.currentPrice;
}

/** Whole-days held from purchaseDate to valuationDate (inclusive of neither
 *  endpoint bias — pure calendar-day difference). */
export function holdingDays(purchaseDate: string, valuationDate: string): number {
  const p = Date.parse(purchaseDate);
  const v = Date.parse(valuationDate);
  return Math.floor((v - p) / MS_PER_DAY);
}

export function portfolioTotalValue(portfolio: Portfolio): number {
  return portfolio.holdings.reduce((sum, h) => sum + holdingCurrentValue(h), 0);
}

export function deriveHoldings(portfolio: Portfolio): DerivedHolding[] {
  const total = portfolioTotalValue(portfolio);
  return portfolio.holdings.map((holding) => {
    const units = holdingUnits(holding);
    const currentValue = units * holding.currentPrice;
    const costBasis = holdingCostBasis(holding);
    const gainLoss = currentValue - costBasis;
    return {
      holding,
      units,
      currentValue,
      costBasis,
      gainLoss,
      gainLossPct: costBasis === 0 ? 0 : (gainLoss / costBasis) * 100,
      weightPct: total === 0 ? 0 : (currentValue / total) * 100,
    };
  });
}

function emptyAllocation(): Record<AssetClass, number> {
  return ASSET_CLASSES.reduce((acc, c) => {
    acc[c] = 0;
    return acc;
  }, {} as Record<AssetClass, number>);
}

/** Current allocation % per asset class, derived from live holding values. */
export function currentAllocation(portfolio: Portfolio): TargetAllocation {
  const total = portfolioTotalValue(portfolio);
  const byClass = emptyAllocation();
  for (const h of portfolio.holdings) {
    byClass[h.assetClass] += holdingCurrentValue(h);
  }
  const pct = emptyAllocation();
  for (const c of ASSET_CLASSES) {
    pct[c] = total === 0 ? 0 : (byClass[c] / total) * 100;
  }
  return pct;
}

/** Per-class drift analysis using the current vs target allocation. This is the
 *  same rule the overview badge and the engine both consume. */
export function analyseAllocation(
  current: TargetAllocation,
  target: TargetAllocation,
): ClassAllocation[] {
  return ASSET_CLASSES.map((assetClass) => {
    const currentPct = current[assetClass];
    const targetPct = target[assetClass];
    const driftPct = currentPct - targetPct;
    const flagged = Math.abs(driftPct) > DRIFT_THRESHOLD_PP;
    const status: ClassAllocation["status"] = !flagged
      ? "within"
      : driftPct > 0
        ? "overweight"
        : "underweight";
    return { assetClass, currentValue: 0, currentPct, targetPct, driftPct, status, flagged };
  });
}

/** Full per-class allocation for a portfolio, with the ₹ value of each class
 *  filled in (used by the donut and drift table). */
export function portfolioAllocations(portfolio: Portfolio): ClassAllocation[] {
  const total = portfolioTotalValue(portfolio);
  const current = currentAllocation(portfolio);
  return analyseAllocation(current, portfolio.targetAllocation).map((a) => ({
    ...a,
    currentValue: (current[a.assetClass] / 100) * total,
  }));
}

/** Convenience: does this portfolio need rebalancing under the drift rule? */
export function needsRebalancing(portfolio: Portfolio): boolean {
  const current = currentAllocation(portfolio);
  return analyseAllocation(current, portfolio.targetAllocation).some((a) => a.flagged);
}

/** Same check from a pre-computed current/target pair (used by the overview,
 *  which receives allocations in the client summary rather than raw holdings). */
export function summaryNeedsRebalancing(
  current: TargetAllocation,
  target: TargetAllocation,
): boolean {
  return analyseAllocation(current, target).some((a) => a.flagged);
}
