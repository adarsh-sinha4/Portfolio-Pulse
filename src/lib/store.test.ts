import { describe, expect, it } from "vitest";
import { applyRebalance, getPortfolio, resetPortfolio } from "./store";
import { generateRebalancePlan } from "./rebalance";
import { currentAllocation } from "./portfolio";

describe("store apply / reset", () => {
  it("applying the plan brings every flagged class within tolerance", () => {
    resetPortfolio("c1");
    const before = getPortfolio("c1")!;
    const plan = generateRebalancePlan(before);
    expect(plan.needsRebalancing).toBe(true);

    const updated = applyRebalance("c1", plan.actions)!;
    const after = generateRebalancePlan(updated);
    // Note: because buys and sells are independent (no cash account), the total
    // shifts on apply, so we converge to within-tolerance rather than exactly on
    // target — which is the correct consequence of that rule.
    expect(after.needsRebalancing).toBe(false);
  });

  it("never drives any lot negative when selling", () => {
    resetPortfolio("c1");
    const plan = generateRebalancePlan(getPortfolio("c1")!);
    const updated = applyRebalance("c1", plan.actions)!;
    for (const h of updated.holdings) {
      for (const lot of h.lots) expect(lot.units).toBeGreaterThanOrEqual(0);
    }
  });

  it("reset restores the original authored allocation", () => {
    const plan = generateRebalancePlan(getPortfolio("c1")!);
    applyRebalance("c1", plan.actions);
    const reset = resetPortfolio("c1")!;
    expect(currentAllocation(reset).Equities).toBeCloseTo(75, 6);
  });
});
