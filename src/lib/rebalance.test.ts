import { describe, expect, it } from "vitest";
import {
  analyseAllocation,
  currentAllocation,
  DRIFT_THRESHOLD_PP,
  holdingDays,
} from "./portfolio";
import {
  classifyLot,
  generateRebalancePlan,
  lotHasExitLoad,
} from "./rebalance";
import { getClient } from "./data";
import type { Holding, Portfolio, TargetAllocation } from "./types";

const VDATE = "2026-06-30";

function eqMfHolding(id: string, price: number, lots: Holding["lots"]): Holding {
  return {
    id,
    instrumentName: id,
    assetClass: "Equities",
    isEquityMutualFund: true,
    currentPrice: price,
    lots,
  };
}

function alloc(eq: number, debt: number, gold: number, re: number, alt: number): TargetAllocation {
  return { Equities: eq, Debt: debt, Gold: gold, "Real Estate": re, Alternatives: alt };
}

// ---------------------------------------------------------------------------
// Lot-level classification & exit load — the 365-day line
// ---------------------------------------------------------------------------

describe("lot classification (the shared 365-day line)", () => {
  const mf = eqMfHolding("mf", 100, []);

  it("classifies a lot held more than 365 days as LTCG", () => {
    expect(classifyLot(mf, lot("2024-01-01"), VDATE)).toBe("LTCG");
  });

  it("classifies a lot held 365 days or fewer as STCG", () => {
    // Exactly 365 days before valuation date => STCG (rule is > 365 for LTCG).
    expect(classifyLot(mf, lot("2025-06-30"), VDATE)).toBe("STCG");
    expect(holdingDays("2025-06-30", VDATE)).toBe(365);
  });

  it("does not classify non-equity, non-MF holdings", () => {
    const gold: Holding = {
      id: "g",
      instrumentName: "Gold ETF",
      assetClass: "Gold",
      isEquityMutualFund: false,
      currentPrice: 60,
      lots: [],
    };
    expect(classifyLot(gold, lot("2020-01-01"), VDATE)).toBe("N/A");
  });

  it("applies exit load only to equity-MF lots held < 365 days", () => {
    expect(lotHasExitLoad(mf, lot("2026-02-15"), VDATE)).toBe(true); // 135d
    expect(lotHasExitLoad(mf, lot("2024-01-01"), VDATE)).toBe(false); // > 365d
  });

  it("never charges exit load on a direct equity even if held < 365 days", () => {
    const stock: Holding = {
      id: "s",
      instrumentName: "Reliance",
      assetClass: "Equities",
      isEquityMutualFund: false,
      currentPrice: 2900,
      lots: [],
    };
    expect(lotHasExitLoad(stock, lot("2026-05-01"), VDATE)).toBe(false);
    expect(classifyLot(stock, lot("2026-05-01"), VDATE)).toBe("STCG"); // still STCG though
  });

  it("guarantees a load-bearing lot is always an STCG lot (rules are aligned)", () => {
    // For any equity-MF lot: exitLoad => STCG.
    for (const d of ["2026-06-01", "2026-01-01", "2025-08-01", "2025-06-30"]) {
      if (lotHasExitLoad(mf, lot(d), VDATE)) {
        expect(classifyLot(mf, lot(d), VDATE)).toBe("STCG");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Drift detection
// ---------------------------------------------------------------------------

describe("drift detection", () => {
  it("does not flag drift of exactly the threshold", () => {
    const a = analyseAllocation(alloc(60, 20, 5, 10, 5), alloc(55, 25, 5, 10, 5));
    const eq = a.find((x) => x.assetClass === "Equities")!;
    expect(eq.driftPct).toBe(DRIFT_THRESHOLD_PP); // 5pp exactly
    expect(eq.flagged).toBe(false);
  });

  it("flags drift greater than the threshold, in either direction", () => {
    const over = analyseAllocation(alloc(66, 14, 5, 10, 5), alloc(60, 20, 5, 10, 5));
    expect(over.find((x) => x.assetClass === "Equities")!.status).toBe("overweight");
    expect(over.find((x) => x.assetClass === "Debt")!.status).toBe("underweight");
  });
});

// ---------------------------------------------------------------------------
// End-to-end engine behaviour on the authored client that needs rebalancing
// ---------------------------------------------------------------------------

describe("generateRebalancePlan — Aarav Mehta (c1)", () => {
  const c1 = getClient("c1") as Portfolio;
  const plan = generateRebalancePlan(c1);

  it("flags the equity overweight and debt underweight", () => {
    expect(plan.needsRebalancing).toBe(true);
    const eq = plan.allocations.find((a) => a.assetClass === "Equities")!;
    const debt = plan.allocations.find((a) => a.assetClass === "Debt")!;
    expect(eq.status).toBe("overweight");
    expect(debt.status).toBe("underweight");
  });

  it("sells the equity excess back toward target exactly", () => {
    const total = c1.aum;
    const excess = ((75 - 55) / 100) * total; // 20pp overweight
    const sold = plan.actions
      .filter((a) => a.type === "SELL")
      .reduce((s, a) => s + a.estimatedValue, 0);
    expect(sold).toBeCloseTo(excess, 0);
  });

  it("exhausts LTCG / load-free lots before touching the STCG lot", () => {
    const mirae = plan.actions.find((a) => a.instrumentId === "c1-mirae")!;
    const ltcg = mirae.lotSales!.find((l) => l.classification === "LTCG")!;
    const stcg = mirae.lotSales!.find((l) => l.classification === "STCG")!;
    // The whole old lot (2000u) is sold; only a slice of the recent lot is taken.
    expect(ltcg.units).toBe(2000);
    expect(stcg.units).toBeGreaterThan(0);
    expect(stcg.exitLoad).toBe(true);
    expect(stcg.exitLoadAmount).toBeCloseTo(stcg.redemptionValue * 0.01, 4);
  });

  it("respects the holdings cap — never sells more than is held", () => {
    for (const action of plan.actions.filter((a) => a.type === "SELL")) {
      expect(action.units).toBeLessThanOrEqual(action.maxSellableUnits! + 1e-6);
    }
  });

  it("marks fully-liquidated positions as cap-binding", () => {
    const reliance = plan.actions.find((a) => a.instrumentId === "c1-rel")!;
    expect(reliance.capBinds).toBe(true);
    expect(reliance.units).toBe(reliance.maxSellableUnits);
  });

  it("produces a BUY for the underweight debt class with no tax constraints", () => {
    const buy = plan.actions.find((a) => a.type === "BUY")!;
    expect(buy.assetClass).toBe("Debt");
    expect(buy.units).toBeGreaterThan(0);
    expect(buy.lotSales).toBeUndefined();
  });
});

describe("generateRebalancePlan — Rohan Kapoor (c3), non-equity sell", () => {
  const c3 = getClient("c3") as Portfolio;
  const plan = generateRebalancePlan(c3);

  it("sells overweight gold with no STCG/LTCG or exit-load labels", () => {
    const goldSell = plan.actions.find((a) => a.assetClass === "Gold" && a.type === "SELL")!;
    expect(goldSell).toBeTruthy();
    expect(goldSell.totalExitLoad).toBe(0);
    for (const ls of goldSell.lotSales!) {
      expect(ls.classification).toBe("N/A");
      expect(ls.exitLoad).toBe(false);
    }
  });

  it("buys the underweight equity class", () => {
    const buy = plan.actions.find((a) => a.assetClass === "Equities" && a.type === "BUY")!;
    expect(buy.units).toBeGreaterThan(0);
  });
});

describe("balanced clients produce no actions", () => {
  for (const id of ["c2", "c4", "c5", "c6", "c7"]) {
    it(`${id} needs no rebalancing`, () => {
      const p = getClient(id) as Portfolio;
      const plan = generateRebalancePlan(p);
      expect(plan.needsRebalancing).toBe(false);
      expect(plan.actions).toHaveLength(0);
      // sanity: derived allocation sums to ~100
      const cur = currentAllocation(p);
      const sum = Object.values(cur).reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(100, 6);
    });
  }
});

// --- helpers ---------------------------------------------------------------

function lot(date: string) {
  return { id: `lot-${date}`, purchaseDate: date, units: 1000, buyPrice: 50 };
}
