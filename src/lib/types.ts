/**
 * Domain model for Portfolio Pulse.
 *
 * Design intent: the rebalancing rules are all
 * lot-level — exit load and gains classification are decided per purchase lot,
 * not per aggregate position. The types below therefore treat the `Lot` as the
 * atomic unit and build `Holding` -> `Portfolio` up from it, so the engine can
 * reason at the granularity the rules actually require.
 */

export const ASSET_CLASSES = [
  "Equities",
  "Debt",
  "Gold",
  "Real Estate",
  "Alternatives",
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];

/** Logical (not alphabetical) risk ordering used for sorting. */
export const RISK_ORDER = ["Conservative", "Moderate", "Aggressive"] as const;

export type RiskProfile = (typeof RISK_ORDER)[number];

/** A single purchase lot. The 365-day line for exit load / gains is measured
 *  from `purchaseDate` to the dataset `valuationDate`. */
export interface Lot {
  id: string;
  purchaseDate: string; // ISO yyyy-mm-dd
  units: number;
  buyPrice: number; // ₹ per unit at purchase (cost basis per unit)
}

export interface Holding {
  id: string;
  instrumentName: string;
  assetClass: AssetClass;
  /** Equity mutual fund flag — exit-load and STCG/LTCG rules apply only to
   *  equities and equity mutual funds. */
  isEquityMutualFund: boolean;
  currentPrice: number; // ₹ per unit / NAV as of valuationDate
  lots: Lot[];
}

export type TargetAllocation = Record<AssetClass, number>; // percentages, sum to 100

/** Summary shape returned by GET /clients. Includes current-vs-target class
 *  allocation so the overview can derive the rebalance badge itself. */
export interface ClientSummary {
  id: string;
  name: string;
  aum: number; // ₹
  return1m: number; // pre-computed % (from API, not derived)
  returnYtd: number; // pre-computed %
  riskProfile: RiskProfile;
  currentAllocation: TargetAllocation;
  targetAllocation: TargetAllocation;
}

/** Full portfolio returned by GET /clients/:id/portfolio. */
export interface Portfolio {
  id: string;
  name: string;
  riskProfile: RiskProfile;
  aum: number;
  return1m: number;
  returnYtd: number;
  valuationDate: string; // ISO — the "as of" date for all holding-period math
  targetAllocation: TargetAllocation;
  holdings: Holding[];
}

export interface PerformancePoint {
  date: string; // ISO
  portfolio: number; // indexed value
  benchmark: number; // indexed value (e.g. Nifty 50)
}

export interface PerformanceSeries {
  clientId: string;
  benchmarkName: string;
  points: PerformancePoint[];
}

// ---------------------------------------------------------------------------
// Derived, engine-facing types
// ---------------------------------------------------------------------------

export interface DerivedHolding {
  holding: Holding;
  units: number;
  currentValue: number; // units * currentPrice
  costBasis: number; // Σ lot.units * lot.buyPrice
  gainLoss: number; // currentValue - costBasis
  gainLossPct: number;
  weightPct: number; // share of total portfolio value
}

export interface ClassAllocation {
  assetClass: AssetClass;
  currentValue: number;
  currentPct: number;
  targetPct: number;
  driftPct: number; // currentPct - targetPct (signed)
  status: "overweight" | "underweight" | "within";
  flagged: boolean; // |driftPct| > DRIFT_THRESHOLD
}

export type GainsClassification = "STCG" | "LTCG" | "N/A";

/** The slice of a lot the engine proposes to sell, with its per-lot verdicts. */
export interface LotSale {
  lotId: string;
  purchaseDate: string;
  holdingDays: number;
  units: number;
  redemptionValue: number; // units * currentPrice
  classification: GainsClassification;
  exitLoad: boolean; // true => 1% exit load applies to this lot's redemption
  exitLoadAmount: number;
}

export interface RebalanceAction {
  id: string;
  type: "BUY" | "SELL";
  instrumentId: string;
  instrumentName: string;
  assetClass: AssetClass;
  units: number;
  estimatedValue: number;
  // Sell-only, lot-level detail:
  lotSales?: LotSale[];
  maxSellableUnits?: number; // holdings cap for this instrument
  capBinds?: boolean; // true => recommendation is limited by units held
  totalExitLoad?: number;
  /** Human-readable constraint tags, always surfaced on the action. */
  constraints: string[];
}

export interface RebalancePlan {
  clientId: string;
  valuationDate: string;
  needsRebalancing: boolean;
  allocations: ClassAllocation[];
  actions: RebalanceAction[];
}

export interface Dataset {
  valuationDate: string;
  benchmarkName: string;
  clients: Portfolio[];
}
