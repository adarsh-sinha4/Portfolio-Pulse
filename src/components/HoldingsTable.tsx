"use client";

import { useMemo } from "react";
import { deriveHoldings } from "@/lib/portfolio";
import { formatINR, formatPct, formatSignedINR, formatSignedPct, formatUnits } from "@/lib/format";
import type { Portfolio } from "@/lib/types";
import { CLASS_COLORS } from "./AllocationDonut";

export function HoldingsTable({ portfolio }: { portfolio: Portfolio }) {
  const rows = useMemo(
    () => deriveHoldings(portfolio).sort((a, b) => b.currentValue - a.currentValue),
    [portfolio],
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface-2">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-muted">
            <th className="px-4 py-3 font-medium">Instrument</th>
            <th className="px-4 py-3 font-medium">Class</th>
            <th className="px-4 py-3 text-right font-medium">Units</th>
            <th className="px-4 py-3 text-right font-medium">Current value</th>
            <th className="px-4 py-3 text-right font-medium">Gain / loss</th>
            <th className="px-4 py-3 text-right font-medium">Weight</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const gainCls =
              r.gainLoss > 0 ? "text-pos" : r.gainLoss < 0 ? "text-neg" : "text-ink-muted";
            return (
              <tr key={r.holding.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.holding.instrumentName}</div>
                  <div className="text-xs text-ink-muted">
                    {r.holding.lots.length} lot{r.holding.lots.length === 1 ? "" : "s"}
                    {r.holding.isEquityMutualFund && " · equity MF"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ background: CLASS_COLORS[r.holding.assetClass] }}
                    />
                    {r.holding.assetClass}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatUnits(r.units)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">
                  {formatINR(r.currentValue)}
                </td>
                <td className={`px-4 py-3 text-right tabular-nums ${gainCls}`}>
                  <div className="font-medium">{formatSignedINR(r.gainLoss)}</div>
                  <div className="text-xs">{formatSignedPct(r.gainLossPct)}</div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPct(r.weightPct)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
