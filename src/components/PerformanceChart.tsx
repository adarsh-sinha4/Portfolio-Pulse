"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PerformanceSeries } from "@/lib/types";
import { formatSignedPct } from "@/lib/format";

interface Props {
  series: PerformanceSeries;
}

export function PerformanceChart({ series }: Props) {
  const { points, benchmarkName } = series;
  const first = points[0];
  const last = points[points.length - 1];
  // Both series are indexed to 100 at the start, so the ending index minus 100
  // is the 6-month return for each — a like-for-like comparison.
  const pfReturn = first && last ? last.portfolio - first.portfolio : 0;
  const bmReturn = first && last ? last.benchmark - first.benchmark : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <LegendItem color="rgb(var(--brand))" label="Portfolio" value={pfReturn} />
        <LegendItem color="#94a3b8" label={benchmarkName} value={bmReturn} />
        <span className="text-xs text-ink-muted">Indexed to 100 · last 6 months</span>
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) =>
                new Date(d).toLocaleDateString("en-IN", { month: "short" })
              }
              minTickGap={40}
              tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }}
              stroke="rgb(var(--line))"
            />
            <YAxis
              domain={["dataMin - 2", "dataMax + 2"]}
              tick={{ fontSize: 11, fill: "rgb(var(--ink-muted))" }}
              stroke="rgb(var(--line))"
              width={44}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={(d: string) =>
                new Date(d).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              }
              formatter={(v: number, name: string) => [
                v.toFixed(2),
                name === "portfolio" ? "Portfolio" : benchmarkName,
              ]}
            />
            <Line
              type="monotone"
              dataKey="portfolio"
              stroke="rgb(var(--brand))"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  const cls = value > 0 ? "text-pos" : value < 0 ? "text-neg" : "text-ink-muted";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: color }} />
      <span className="font-medium">{label}</span>
      <span className={`text-xs font-semibold ${cls}`}>{formatSignedPct(value)}</span>
    </span>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "rgb(var(--surface-2))",
  border: "1px solid rgb(var(--line))",
  borderRadius: 8,
  color: "rgb(var(--ink))",
  fontSize: 12,
};
