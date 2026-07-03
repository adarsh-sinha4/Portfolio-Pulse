"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ASSET_CLASSES, type AssetClass, type ClassAllocation } from "@/lib/types";
import { formatPct, formatSignedPct } from "@/lib/format";

// A fixed, colour-blind-friendly palette keyed by asset class so the donut and
// the legend always agree.
export const CLASS_COLORS: Record<AssetClass, string> = {
  Equities: "#2563eb",
  Debt: "#0d9488",
  Gold: "#d97706",
  "Real Estate": "#7c3aed",
  Alternatives: "#64748b",
};

interface Props {
  allocations: ClassAllocation[];
}

export function AllocationDonut({ allocations }: Props) {
  const data = ASSET_CLASSES.map((c) => {
    const a = allocations.find((x) => x.assetClass === c)!;
    return { name: c, value: Math.max(a.currentPct, 0), alloc: a };
  }).filter((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,200px)_1fr] sm:items-center">
      <div className="relative mx-auto h-[200px] w-[200px]">
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-ink-muted">Current</span>
          <span className="text-sm font-semibold">allocation</span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={CLASS_COLORS[d.name]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number, _n, item: { payload?: { alloc: ClassAllocation } }) => {
                const alloc = item.payload?.alloc;
                if (!alloc) return [formatPct(v), _n];
                return [`${formatPct(v)} (target ${formatPct(alloc.targetPct)})`, alloc.assetClass];
              }}
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
            <th className="py-1 font-medium">Class</th>
            <th className="py-1 text-right font-medium">Current</th>
            <th className="py-1 text-right font-medium">Target</th>
            <th className="py-1 text-right font-medium">Drift</th>
          </tr>
        </thead>
        <tbody>
          {allocations.map((a) => (
            <tr key={a.assetClass} className="border-t border-line">
              <td className="py-1.5">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ background: CLASS_COLORS[a.assetClass] }}
                  />
                  {a.assetClass}
                </span>
              </td>
              <td className="py-1.5 text-right tabular-nums">{formatPct(a.currentPct)}</td>
              <td className="py-1.5 text-right tabular-nums text-ink-muted">
                {formatPct(a.targetPct)}
              </td>
              <td
                className={`py-1.5 text-right tabular-nums font-medium ${
                  a.flagged ? "text-warn" : "text-ink-muted"
                }`}
              >
                {formatSignedPct(a.driftPct)}
                {a.flagged && " ⚠"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "rgb(var(--surface-2))",
  border: "1px solid rgb(var(--line))",
  borderRadius: 8,
  color: "rgb(var(--ink))",
  fontSize: 12,
};

const tooltipItemStyle: React.CSSProperties = {
  color: "rgb(var(--ink))",
};
