import { currentAllocation, portfolioTotalValue } from "./portfolio";
import type { ClientSummary, Portfolio } from "./types";

/** Build the overview summary for a portfolio. AUM and current allocation are
 *  derived from live holdings; returns are the pre-computed figures. The current
 *  vs target allocation is included so the overview can derive the rebalance
 *  badge itself. */
export function toSummary(p: Portfolio): ClientSummary {
  return {
    id: p.id,
    name: p.name,
    aum: Math.round(portfolioTotalValue(p)),
    return1m: p.return1m,
    returnYtd: p.returnYtd,
    riskProfile: p.riskProfile,
    currentAllocation: currentAllocation(p),
    targetAllocation: p.targetAllocation,
  };
}
