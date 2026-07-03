/* Standalone sanity harness — not part of the app build. Run with: tsx scripts/verify.ts */
import { dataset } from "../src/lib/data";
import { analyseAllocation, currentAllocation, portfolioTotalValue } from "../src/lib/portfolio";
import { generateRebalancePlan } from "../src/lib/rebalance";
import { ASSET_CLASSES } from "../src/lib/types";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

console.log("Valuation date:", dataset.valuationDate, "\n");

for (const c of dataset.clients) {
  const total = portfolioTotalValue(c);
  const cur = currentAllocation(c);
  const allocs = analyseAllocation(cur, c.targetAllocation);
  const flagged = allocs.filter((a) => a.flagged);
  console.log(`${c.id}  ${c.name}  [${c.riskProfile}]  AUM=${inr(total)}`);
  for (const cls of ASSET_CLASSES) {
    const a = allocs.find((x) => x.assetClass === cls)!;
    const mark = a.flagged ? `  <== ${a.status.toUpperCase()} (${a.driftPct.toFixed(1)}pp)` : "";
    console.log(
      `   ${cls.padEnd(12)} cur ${a.currentPct.toFixed(1).padStart(5)}%  tgt ${a.targetPct
        .toFixed(1)
        .padStart(5)}%${mark}`,
    );
  }
  console.log(`   needsRebalancing: ${flagged.length > 0}`);

  const plan = generateRebalancePlan(c);
  for (const act of plan.actions) {
    console.log(
      `   >>> ${act.type} ${act.instrumentName} — ${act.units} units (${inr(act.estimatedValue)})`,
    );
    for (const con of act.constraints) console.log(`        · ${con}`);
    if (act.lotSales) {
      for (const ls of act.lotSales) {
        console.log(
          `        lot ${ls.lotId} ${ls.purchaseDate} held=${ls.holdingDays}d ` +
            `${ls.units}u ${inr(ls.redemptionValue)} [${ls.classification}${
              ls.exitLoad ? " +LOAD ₹" + Math.round(ls.exitLoadAmount) : ""
            }]`,
        );
      }
    }
  }
  console.log("");
}
